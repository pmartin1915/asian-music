import { useRef, useState, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { InstrumentAudioResult } from '../types/music';
import { base64ToBlobUrl } from '../utils/audio';
import type { PlaybackControls } from '../hooks/useKeyboardShortcuts';

interface PlaybackState {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
}

interface AudioPlayerProps {
    audioUrl: string | null;
    audioResults?: InstrumentAudioResult[];
    onPlaybackChange?: (state: PlaybackState) => void;
}

export interface AudioPlayerRef {
    controls: PlaybackControls;
}

export const AudioPlayer = forwardRef<AudioPlayerRef, AudioPlayerProps>(
    ({ audioUrl, audioResults = [], onPlaybackChange }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const [trackUrls, setTrackUrls] = useState<string[]>([]);

    // Convert all audio results to blob URLs
    useEffect(() => {
        if (audioResults.length === 0) {
            setTrackUrls((prev) => {
                prev.forEach((url) => URL.revokeObjectURL(url));
                return [];
            });
            return;
        }

        const urls: string[] = [];
        let failedCount = 0;

        audioResults.forEach((result) => {
            try {
                urls.push(base64ToBlobUrl(result.audioContent));
            } catch {
                failedCount++;
            }
        });

        if (failedCount > 0) {
            toast.error(`Failed to decode ${failedCount} track(s)`);
        }

        setTrackUrls((prev) => {
            // Cleanup previous URLs before setting new ones
            prev.forEach((url) => URL.revokeObjectURL(url));
            return urls;
        });
        setCurrentTrackIndex(0);

        return () => {
            urls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [audioResults]);

    useEffect(() => {
        if (audioUrl && audioRef.current) {
            audioRef.current.load();
            setIsPlaying(false);
            setProgress(0);
        }
    }, [audioUrl]);

    const togglePlay = useCallback(() => {
        if (!audioRef.current || !audioUrl) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    }, [audioUrl, isPlaying]);

    const seek = useCallback((time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
    }, []);

    // Expose controls for keyboard shortcuts
    useImperativeHandle(ref, () => ({
        controls: {
            togglePlay,
            seek,
            getCurrentTime: () => audioRef.current?.currentTime ?? 0,
            getDuration: () => audioRef.current?.duration ?? 0,
            isReady: !!audioUrl,
        },
    }), [togglePlay, seek, audioUrl]);

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const duration = audioRef.current.duration || 1;
            const currentTime = audioRef.current.currentTime;
            setProgress((currentTime / duration) * 100);
            onPlaybackChange?.({
                isPlaying: !audioRef.current.paused,
                currentTime,
                duration,
            });
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
        onPlaybackChange?.({
            isPlaying: false,
            currentTime: 0,
            duration: audioRef.current?.duration || 0,
        });
    };

    const switchTrack = (index: number) => {
        if (index >= 0 && index < trackUrls.length) {
            setCurrentTrackIndex(index);
            setIsPlaying(false);
            setProgress(0);
            if (audioRef.current) {
                audioRef.current.load();
            }
        }
    };

    // Use current track URL or fall back to single audioUrl
    const currentAudioUrl = trackUrls.length > 0 ? trackUrls[currentTrackIndex] : audioUrl;
    const hasMultipleTracks = audioResults.length > 1;

    if (!currentAudioUrl) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="max-w-4xl mx-auto">
                {/* Track selector (only show if multiple tracks) */}
                {hasMultipleTracks && (
                    <div className="flex gap-2 mb-3 justify-center">
                        {audioResults.map((result, index) => (
                            <button
                                key={result.instrument}
                                onClick={() => switchTrack(index)}
                                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                    index === currentTrackIndex
                                        ? 'bg-silk-stone text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {result.instrument}
                            </button>
                        ))}
                    </div>
                )}

                {/* Player controls */}
                <div className="flex items-center gap-4">
                    <audio
                        ref={audioRef}
                        src={currentAudioUrl}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={handleEnded}
                    />

                    <button
                        onClick={togglePlay}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                        aria-pressed={isPlaying}
                        className="w-12 h-12 rounded-full bg-silk-stone text-white flex items-center justify-center hover:bg-black transition-colors"
                    >
                        {isPlaying ? '⏸' : '▶'}
                    </button>

                    <div className="flex-1">
                        <div
                            className="h-2 bg-gray-200 rounded-full overflow-hidden"
                            role="progressbar"
                            aria-label="Playback progress"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(progress)}
                        >
                            <div
                                className="h-full bg-silk-amber transition-all duration-100"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Current track label */}
                    {hasMultipleTracks && (
                        <span className="text-xs text-gray-500 font-medium min-w-[60px]">
                            {audioResults[currentTrackIndex]?.instrument}
                        </span>
                    )}

                    <a
                        href={currentAudioUrl}
                        download={`silk-road-${audioResults.length > 0 && audioResults[currentTrackIndex]?.instrument ? audioResults[currentTrackIndex].instrument : 'composition'}.wav`}
                        className="text-sm font-medium text-silk-stone hover:text-silk-red"
                    >
                        Download
                    </a>
                </div>
            </div>
        </div>
    );
});
