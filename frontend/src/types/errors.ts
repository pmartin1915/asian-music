// Error type definitions for Silk Road Composer

import type { Composition, InstrumentAudioResult } from './music';

// API error codes for categorization
export type ApiErrorCode =
    | 'NETWORK_ERROR'      // No connectivity
    | 'TIMEOUT'            // Request timed out
    | 'AUTH_ERROR'         // Firebase auth issue
    | 'VALIDATION_ERROR'   // Invalid params sent
    | 'SERVER_ERROR'       // Backend 5xx
    | 'RATE_LIMIT'         // Too many requests
    | 'QUOTA_EXCEEDED'     // API quota exhausted
    | 'GENERATION_FAILED'  // All instruments failed to generate
    | 'UNKNOWN';           // Fallback

// Audio processing error codes
export type AudioErrorCode =
    | 'INVALID_BASE64'     // Malformed base64 string
    | 'DECODE_FAILED'      // Web Audio decode error
    | 'CONTEXT_ERROR'      // AudioContext issue
    | 'UNSUPPORTED_FORMAT' // Unknown audio format
    | 'UNKNOWN';

// Combined error codes for message lookup
export type ErrorCode = ApiErrorCode | AudioErrorCode;

// Base error class with common properties
export class AppError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly retryable: boolean = false,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'AppError';
        // Maintains proper stack trace in V8 environments
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

// API-specific errors with Firebase integration
export class ApiError extends AppError {
    constructor(
        message: string,
        public readonly code: ApiErrorCode,
        retryable: boolean = false,
        public readonly statusCode?: number,
        cause?: Error
    ) {
        super(message, code, retryable, cause);
        this.name = 'ApiError';
    }
}

// Audio processing errors
export class AudioError extends AppError {
    constructor(
        message: string,
        public readonly code: AudioErrorCode,
        public readonly instrument?: string,
        cause?: Error
    ) {
        // DECODE_FAILED could be transient (corrupted transmission), so it's retryable
        const retryable = code === 'DECODE_FAILED';
        super(message, code, retryable, cause);
        this.name = 'AudioError';
    }
}

// Partial results when generation partially succeeds
export interface PartialGenerationResult {
    composition?: Composition;
    successfulInstruments: InstrumentAudioResult[];
    failedInstruments: string[];
}

// Generation errors with partial success support
export class GenerationError extends AppError {
    constructor(
        message: string,
        code: string,
        retryable: boolean,
        public readonly partialResults?: PartialGenerationResult,
        cause?: Error
    ) {
        super(message, code, retryable, cause);
        this.name = 'GenerationError';
    }
}

// User-friendly error messages
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
    // API errors
    NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
    TIMEOUT: 'The request took too long. Please try again.',
    AUTH_ERROR: 'Authentication failed. Please refresh the page.',
    VALIDATION_ERROR: 'Invalid composition parameters.',
    SERVER_ERROR: 'The server encountered an error. Please try again later.',
    RATE_LIMIT: 'Too many requests. Please wait a moment.',
    QUOTA_EXCEEDED: 'API quota exceeded. Please try again tomorrow.',
    GENERATION_FAILED: 'Failed to generate audio for all instruments.',
    // Audio errors
    INVALID_BASE64: 'Received corrupted audio data.',
    DECODE_FAILED: 'Unable to decode the audio file.',
    CONTEXT_ERROR: 'Audio system unavailable. Please refresh.',
    UNSUPPORTED_FORMAT: 'Unsupported audio format received.',
    // Fallback
    UNKNOWN: 'An unexpected error occurred.',
};

// Firebase Functions error code mapping
export const FIREBASE_ERROR_MAP: Record<string, { code: ApiErrorCode; retryable: boolean }> = {
    'functions/deadline-exceeded': { code: 'TIMEOUT', retryable: true },
    'functions/unavailable': { code: 'NETWORK_ERROR', retryable: true },
    'functions/resource-exhausted': { code: 'RATE_LIMIT', retryable: true },
    'functions/internal': { code: 'SERVER_ERROR', retryable: true },
    'functions/unauthenticated': { code: 'AUTH_ERROR', retryable: false },
    'functions/permission-denied': { code: 'AUTH_ERROR', retryable: false },
    'functions/invalid-argument': { code: 'VALIDATION_ERROR', retryable: false },
    'functions/not-found': { code: 'SERVER_ERROR', retryable: false },
    'functions/already-exists': { code: 'VALIDATION_ERROR', retryable: false },
    'functions/cancelled': { code: 'UNKNOWN', retryable: true },
};

/**
 * Maps a Firebase Functions error to a typed ApiError.
 */
export function mapFirebaseError(error: unknown): ApiError {
    // Check if it's a Firebase Functions error with code property
    if (error && typeof error === 'object' && 'code' in error) {
        const firebaseCode = (error as { code: string }).code;
        const mapping = FIREBASE_ERROR_MAP[firebaseCode];

        if (mapping) {
            const message = error instanceof Error
                ? error.message
                : (error as { message?: string }).message || 'API request failed';
            return new ApiError(
                message,
                mapping.code,
                mapping.retryable,
                undefined,
                error instanceof Error ? error : undefined
            );
        }
    }

    // Network/fetch errors (TypeError for network failures)
    if (error instanceof TypeError) {
        return new ApiError('Network error', 'NETWORK_ERROR', true, undefined, error);
    }

    // Default to unknown
    return new ApiError(
        error instanceof Error ? error.message : 'Unknown error',
        'UNKNOWN',
        false,
        undefined,
        error instanceof Error ? error : undefined
    );
}

/**
 * Gets a user-friendly error message for display.
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof ApiError || error instanceof AudioError) {
        return ERROR_MESSAGES[error.code] || error.message;
    }

    if (error instanceof GenerationError) {
        const partial = error.partialResults;
        if (partial && partial.successfulInstruments.length > 0) {
            const failed = partial.failedInstruments.join(', ');
            return `Partial success. Failed: ${failed}`;
        }
        return ERROR_MESSAGES[error.code as ErrorCode] || error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return ERROR_MESSAGES.UNKNOWN;
}

/**
 * Checks if an error is retryable.
 */
export function isRetryableError(error: unknown): boolean {
    if (error instanceof AppError) {
        return error.retryable;
    }
    // Network errors are typically retryable
    if (error instanceof TypeError) {
        return true;
    }
    return false;
}
