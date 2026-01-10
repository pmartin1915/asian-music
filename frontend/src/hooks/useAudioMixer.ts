import { useState, useRef, useCallback, useEffect } from 'react';
import type { InstrumentAudioResult, Instrument } from '../types/music';
import { AudioError } from '../types/errors';
import { base64ToArrayBuffer } from '../utils/audio';

interface TrackState {
    instrument: Instrument;
    buffer: AudioBuffer | null;
    gainNode: GainNode | null;
    volume: number;
    muted: boolean;
    error?: AudioError;
}

interface MixerState {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    tracks: Map<Instrument, TrackState>;
    failedTracks: Map<Instrument, AudioError>;
    isReady: boolean;
}

export const useAudioMixer = (audioResults: InstrumentAudioResult[]) => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodesRef = useRef<Map<Instrument, AudioBufferSourceNode>>(new Map());
    const startTimeRef = useRef<number>(0);
    const pauseTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number | null>(null);

    const [state, setState] = useState<MixerState>({
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        tracks: new Map(),
        failedTracks: new Map(),
        isReady: false,
    });

    // Initialize audio context and decode audio buffers
    useEffect(() => {
        if (audioResults.length === 0) {
            setState((prev) => ({
                ...prev,
                tracks: new Map(),
                failedTracks: new Map(),
                duration: 0,
                currentTime: 0,
                isReady: false,
            }));
            return;
        }

        const initAudio = async () => {
            // Create or resume audio context
            if (!audioContextRef.current) {
                try {
                    audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
                } catch (error) {
                    console.error('[AudioMixer] Failed to create AudioContext:', error);
                    // All tracks fail if context can't be created
                    const failedTracks = new Map<Instrument, AudioError>();
                    const contextError = new AudioError(
                        'Failed to initialize audio system',
                        'CONTEXT_ERROR',
                        undefined,
                        error instanceof Error ? error : undefined
                    );
                    for (const result of audioResults) {
                        failedTracks.set(result.instrument, contextError);
                    }
                    setState((prev) => ({
                        ...prev,
                        failedTracks,
                        isReady: false,
                    }));
                    return;
                }
            }

            const ctx = audioContextRef.current;
            const tracks = new Map<Instrument, TrackState>();
            const failedTracks = new Map<Instrument, AudioError>();
            let maxDuration = 0;

            for (const result of audioResults) {
                try {
                    // Decode base64 to ArrayBuffer - throws AudioError for invalid data
                    const arrayBuffer = base64ToArrayBuffer(result.audioContent, result.instrument);
                    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

                    // Create gain node for volume control
                    const gainNode = ctx.createGain();
                    gainNode.connect(ctx.destination);

                    tracks.set(result.instrument, {
                        instrument: result.instrument,
                        buffer: audioBuffer,
                        gainNode,
                        volume: 1,
                        muted: false,
                    });

                    maxDuration = Math.max(maxDuration, audioBuffer.duration);
                } catch (error) {
                    // Categorize the error properly
                    const audioError = error instanceof AudioError
                        ? error
                        : new AudioError(
                            `Failed to decode audio for ${result.instrument}`,
                            'DECODE_FAILED',
                            result.instrument,
                            error instanceof Error ? error : undefined
                        );

                    failedTracks.set(result.instrument, audioError);
                    console.error(`[AudioMixer] ${result.instrument}:`, audioError.message);
                }
            }

            setState((prev) => ({
                ...prev,
                tracks,
                failedTracks,
                duration: maxDuration,
                isReady: tracks.size > 0,
            }));
        };

        initAudio();

        return () => {
            // Cleanup
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            sourceNodesRef.current.forEach((source) => {
                try {
                    source.stop();
                } catch {
                    // Source might already be stopped
                }
            });
            sourceNodesRef.current.clear();
        };
    }, [audioResults]);

    // Update current time during playback
    const updateTime = useCallback(() => {
        if (!audioContextRef.current || !state.isPlaying) return;

        const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
        const currentTime = pauseTimeRef.current + elapsed;

        if (currentTime >= state.duration) {
            // Playback ended
            setState((prev) => ({
                ...prev,
                isPlaying: false,
                currentTime: 0,
            }));
            pauseTimeRef.current = 0;
            return;
        }

        setState((prev) => ({
            ...prev,
            currentTime,
        }));

        animationFrameRef.current = requestAnimationFrame(updateTime);
    }, [state.isPlaying, state.duration]);

    // Start or resume playback
    const play = useCallback(() => {
        if (!audioContextRef.current || state.tracks.size === 0) return;

        const ctx = audioContextRef.current;

        // Resume context if suspended
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        // Stop existing sources
        sourceNodesRef.current.forEach((source) => {
            try {
                source.stop();
            } catch {
                // Already stopped
            }
        });
        sourceNodesRef.current.clear();

        // Create new source nodes for each track
        state.tracks.forEach((track, instrument) => {
            if (!track.buffer || !track.gainNode) return;

            const source = ctx.createBufferSource();
            source.buffer = track.buffer;
            source.connect(track.gainNode);

            // Start from pause position
            source.start(0, pauseTimeRef.current);
            sourceNodesRef.current.set(instrument, source);
        });

        startTimeRef.current = ctx.currentTime;
        setState((prev) => ({ ...prev, isPlaying: true }));

        // Start time update loop
        animationFrameRef.current = requestAnimationFrame(updateTime);
    }, [state.tracks, updateTime]);

    // Pause playback
    const pause = useCallback(() => {
        if (!audioContextRef.current) return;

        const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
        pauseTimeRef.current += elapsed;

        // Stop all sources
        sourceNodesRef.current.forEach((source) => {
            try {
                source.stop();
            } catch {
                // Already stopped
            }
        });
        sourceNodesRef.current.clear();

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        setState((prev) => ({ ...prev, isPlaying: false }));
    }, []);

    // Seek to position
    const seek = useCallback((time: number) => {
        const wasPlaying = state.isPlaying;

        if (wasPlaying) {
            pause();
        }

        pauseTimeRef.current = Math.max(0, Math.min(time, state.duration));
        setState((prev) => ({ ...prev, currentTime: pauseTimeRef.current }));

        if (wasPlaying) {
            // Small delay to ensure sources are stopped
            setTimeout(play, 10);
        }
    }, [state.isPlaying, state.duration, pause, play]);

    // Set volume for a track
    const setTrackVolume = useCallback((instrument: Instrument, volume: number) => {
        const track = state.tracks.get(instrument);
        if (track?.gainNode) {
            const clampedVolume = Math.max(0, Math.min(1, volume));
            track.gainNode.gain.value = track.muted ? 0 : clampedVolume;

            setState((prev) => {
                const newTracks = new Map(prev.tracks);
                const existingTrack = newTracks.get(instrument);
                if (existingTrack) {
                    newTracks.set(instrument, { ...existingTrack, volume: clampedVolume });
                }
                return { ...prev, tracks: newTracks };
            });
        }
    }, [state.tracks]);

    // Toggle mute for a track
    const toggleMute = useCallback((instrument: Instrument) => {
        const track = state.tracks.get(instrument);
        if (track?.gainNode) {
            const newMuted = !track.muted;
            track.gainNode.gain.value = newMuted ? 0 : track.volume;

            setState((prev) => {
                const newTracks = new Map(prev.tracks);
                const existingTrack = newTracks.get(instrument);
                if (existingTrack) {
                    newTracks.set(instrument, { ...existingTrack, muted: newMuted });
                }
                return { ...prev, tracks: newTracks };
            });
        }
    }, [state.tracks]);

    // Toggle play/pause
    const togglePlay = useCallback(() => {
        if (state.isPlaying) {
            pause();
        } else {
            play();
        }
    }, [state.isPlaying, pause, play]);

    return {
        isPlaying: state.isPlaying,
        currentTime: state.currentTime,
        duration: state.duration,
        tracks: state.tracks,
        failedTracks: state.failedTracks,
        isReady: state.isReady,
        hasPartialFailure: state.failedTracks.size > 0 && state.tracks.size > 0,
        play,
        pause,
        togglePlay,
        seek,
        setTrackVolume,
        toggleMute,
    };
};
