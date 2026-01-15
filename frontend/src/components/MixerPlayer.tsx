import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useAudioMixer } from '../hooks/useAudioMixer';
import type { InstrumentAudioResult, Instrument } from '../types/music';
import type { PlaybackControls } from '../hooks/useKeyboardShortcuts';

interface PlaybackState {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
}

interface MixerPlayerProps {
    audioResults: InstrumentAudioResult[];
    onPlaybackChange?: (state: PlaybackState) => void;
}

export interface MixerPlayerRef {
    controls: PlaybackControls;
}

const INSTRUMENT_ICONS: Record<Instrument, string> = {
    erhu: '🎻',
    guzheng: '🎸',
    pipa: '🪕',
    dizi: '🪈',
};

export const MixerPlayer = forwardRef<MixerPlayerRef, MixerPlayerProps>(
    ({ audioResults, onPlaybackChange }, ref) => {
    const mixer = useAudioMixer(audioResults);

    // Expose controls for keyboard shortcuts
    useImperativeHandle(ref, () => ({
        controls: {
            togglePlay: mixer.togglePlay,
            seek: mixer.seek,
            getCurrentTime: () => mixer.currentTime,
            getDuration: () => mixer.duration,
            isReady: mixer.isReady,
        },
    }), [mixer.togglePlay, mixer.seek, mixer.currentTime, mixer.duration, mixer.isReady]);

    // Notify parent of playback state changes
    useEffect(() => {
        onPlaybackChange?.({
            isPlaying: mixer.isPlaying,
            currentTime: mixer.currentTime,
            duration: mixer.duration,
        });
    }, [mixer.isPlaying, mixer.currentTime, mixer.duration, onPlaybackChange]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (mixer.duration <= 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        mixer.seek(percentage * mixer.duration);
    };

    const progress = mixer.duration > 0 ? (mixer.currentTime / mixer.duration) * 100 : 0;

    if (audioResults.length === 0) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="max-w-4xl mx-auto p-4">
                {/* Track Mixer Controls */}
                {audioResults.length > 1 && (
                    <div
                        className="flex gap-3 mb-4 justify-center flex-wrap"
                        role="region"
                        aria-label="Track mixer controls"
                    >
                        {Array.from(mixer.tracks.entries()).map(([instrument, track]) => (
                            <div
                                key={instrument}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                                    track.muted
                                        ? 'bg-gray-100 text-gray-400'
                                        : 'bg-silk-amber/10 text-silk-stone'
                                }`}
                            >
                                <span className="text-lg">{INSTRUMENT_ICONS[instrument]}</span>
                                <span className="text-sm font-medium capitalize">{instrument}</span>

                                {/* Volume slider */}
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={track.volume}
                                    onChange={(e) => mixer.setTrackVolume(instrument, parseFloat(e.target.value))}
                                    className="w-16 h-1 accent-silk-amber"
                                    disabled={track.muted}
                                    aria-label={`${instrument} volume`}
                                    aria-valuetext={`${Math.round(track.volume * 100)}%`}
                                />

                                {/* Mute button */}
                                <button
                                    onClick={() => mixer.toggleMute(instrument)}
                                    className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${
                                        track.muted
                                            ? 'bg-silk-red text-white'
                                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                    }`}
                                    aria-pressed={track.muted}
                                    aria-label={`${track.muted ? 'Unmute' : 'Mute'} ${instrument}`}
                                >
                                    {track.muted ? '🔇' : '🔊'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Main Controls */}
                <div className="flex items-center gap-4">
                    {/* Play/Pause Button */}
                    <button
                        onClick={mixer.togglePlay}
                        aria-label={mixer.isPlaying ? 'Pause' : 'Play'}
                        aria-pressed={mixer.isPlaying}
                        className="w-12 h-12 rounded-full bg-silk-stone text-white flex items-center justify-center hover:bg-black transition-colors"
                    >
                        {mixer.isPlaying ? '⏸' : '▶'}
                    </button>

                    {/* Time Display */}
                    <span
                        className="text-xs text-gray-500 font-mono min-w-[40px]"
                        aria-live="off"
                        aria-atomic="true"
                    >
                        {formatTime(mixer.currentTime)}
                    </span>

                    {/* Progress Bar */}
                    <div
                        className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden cursor-pointer"
                        onClick={handleProgressClick}
                        role="slider"
                        tabIndex={0}
                        aria-label="Playback position"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress)}
                        aria-valuetext={`${formatTime(mixer.currentTime)} of ${formatTime(mixer.duration)}`}
                    >
                        <div
                            className="h-full bg-silk-amber transition-all duration-100"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* Duration */}
                    <span className="text-xs text-gray-500 font-mono min-w-[40px]">
                        {formatTime(mixer.duration)}
                    </span>

                    {/* Ensemble Label */}
                    {audioResults.length > 1 && (
                        <span className="text-xs text-silk-amber font-medium px-2 py-1 bg-silk-amber/10 rounded">
                            Ensemble ({audioResults.length} tracks)
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
});
