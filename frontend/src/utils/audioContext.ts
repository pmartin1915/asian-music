/**
 * Singleton AudioContext manager for pre-warming and shared access.
 *
 * Pre-warming the AudioContext on first user interaction eliminates
 * the ~50-100ms initialization delay on first audio playback.
 */

let audioContext: AudioContext | null = null;
let isWarming = false;

/**
 * Get or create the shared AudioContext instance.
 * Creates context on first call; returns existing instance thereafter.
 */
export const getAudioContext = (): AudioContext => {
    if (!audioContext) {
        audioContext = new (window.AudioContext ||
            (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContext;
};

/**
 * Pre-warm the AudioContext on user interaction.
 * Call this early (e.g., on first click/keydown) to ensure
 * the context is ready when audio generation completes.
 *
 * Safe to call multiple times - only initializes once.
 */
export const warmAudioContext = (): void => {
    if (audioContext || isWarming) return;
    isWarming = true;
    try {
        const ctx = getAudioContext();
        // Resume if suspended (browsers suspend contexts created before user gesture)
        if (ctx.state === 'suspended') {
            ctx.resume().catch((err) => {
                console.warn('[AudioContext] Failed to resume:', err);
            });
        }
    } finally {
        isWarming = false;
    }
};

/**
 * Close and dispose of the AudioContext.
 * Call on app unmount to clean up resources.
 */
export const closeAudioContext = (): void => {
    if (audioContext) {
        audioContext.close().catch((err) => {
            console.warn('[AudioContext] Failed to close:', err);
        });
        audioContext = null;
    }
};

/**
 * Check if an AudioContext is available and ready.
 */
export const isAudioContextReady = (): boolean => {
    return audioContext !== null && audioContext.state === 'running';
};
