import { useEffect, useCallback, useRef } from 'react';

/**
 * Playback control interface for keyboard shortcuts.
 * Both AudioPlayer and MixerPlayer can implement these actions.
 */
export interface PlaybackControls {
    togglePlay: () => void;
    seek: (time: number) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    isReady: boolean;
}

interface KeyboardShortcutsOptions {
    controls: PlaybackControls | null;
    seekAmount?: number; // seconds to seek, default 5
    enabled?: boolean;
}

/**
 * Keyboard shortcuts for audio playback control.
 *
 * Shortcuts:
 * - Space: Toggle play/pause
 * - ArrowLeft: Seek backward 5 seconds
 * - ArrowRight: Seek forward 5 seconds
 * - Home: Seek to beginning
 * - End: Seek to end (minus 1 second)
 *
 * Shortcuts are disabled when:
 * - User is typing in an input/textarea
 * - No audio is loaded (controls.isReady is false)
 */
export const useKeyboardShortcuts = ({
    controls,
    seekAmount = 5,
    enabled = true,
}: KeyboardShortcutsOptions): void => {
    // Track enabled state to avoid stale closures
    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            // Skip if disabled
            if (!enabledRef.current || !controls?.isReady) return;

            // Skip if user is typing in an input field
            const target = event.target as HTMLElement;
            const isInputField =
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT' ||
                target.isContentEditable;

            if (isInputField) return;

            const currentTime = controls.getCurrentTime();
            const duration = controls.getDuration();

            switch (event.code) {
                case 'Space':
                    event.preventDefault();
                    controls.togglePlay();
                    break;

                case 'ArrowLeft':
                    event.preventDefault();
                    controls.seek(Math.max(0, currentTime - seekAmount));
                    break;

                case 'ArrowRight':
                    event.preventDefault();
                    controls.seek(Math.min(duration, currentTime + seekAmount));
                    break;

                case 'Home':
                    event.preventDefault();
                    controls.seek(0);
                    break;

                case 'End':
                    event.preventDefault();
                    // Seek to near end (1 second before) to allow playback to finish naturally
                    controls.seek(Math.max(0, duration - 1));
                    break;

                default:
                    // Not a recognized shortcut
                    break;
            }
        },
        [controls, seekAmount]
    );

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [enabled, handleKeyDown]);
};
