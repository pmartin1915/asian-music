/**
 * Centralized configuration constants for the Silk Road Composer.
 * Consolidates hardcoded values from across the codebase.
 */

/** Default values for composition parameters */
export const DEFAULTS = {
    /** Default tempo in BPM */
    TEMPO: 72,
    /** Estimated duration per musical section in seconds (for visualization) */
    SECTION_DURATION: 15,
} as const;

/** API timeout configuration in milliseconds */
export const API_TIMEOUTS = {
    /** Timeout for composition generation (Gemini API) */
    COMPOSE: 60000,
    /** Timeout for audio synthesis (Lyria API) - longer due to audio processing */
    GENERATE: 300000,
} as const;

/** localStorage configuration */
export const STORAGE = {
    /** Key for storing composition history */
    HISTORY_KEY: 'silk-road-compositions',
    /** Maximum number of compositions to keep in history */
    MAX_HISTORY: 10,
    /** Fallback limit when quota is exceeded */
    FALLBACK_HISTORY: 5,
} as const;

/** Audio configuration */
export const AUDIO = {
    /** Default MIME type for generated audio */
    MIME_TYPE: 'audio/wav',
} as const;

/** Retry configuration for transient failures */
export const RETRY = {
    /** Maximum retry attempts for API calls */
    MAX_ATTEMPTS: 3,
    /** Base delay in milliseconds before first retry */
    BASE_DELAY_MS: 1000,
    /** Maximum delay cap in milliseconds */
    MAX_DELAY_MS: 10000,
} as const;
