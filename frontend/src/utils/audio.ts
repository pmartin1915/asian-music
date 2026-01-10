/**
 * Audio utility functions for base64 encoding/decoding and blob management.
 * Consolidates duplicated logic from App.tsx, AudioPlayer.tsx, and useAudioMixer.ts.
 */

import { AudioError } from '../types/errors';

/**
 * Regex for validating base64 strings.
 * Must be valid base64 characters with proper padding.
 */
const BASE64_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Validates that a string is valid base64 encoding.
 * @param str - String to validate
 * @returns true if valid base64, false otherwise
 */
export function isValidBase64(str: string): boolean {
    if (!str || str.length === 0) {
        return false;
    }
    // Base64 strings must have length divisible by 4
    if (str.length % 4 !== 0) {
        return false;
    }
    return BASE64_REGEX.test(str);
}

/**
 * Safely decodes base64 with validation and typed error handling.
 * @param base64 - The base64-encoded string to decode
 * @param context - Optional context for error messages (e.g., instrument name)
 * @returns The decoded binary string
 * @throws AudioError if base64 is invalid or decoding fails
 */
function safeAtob(base64: string, context?: string): string {
    // Validate format before attempting decode
    if (!isValidBase64(base64)) {
        throw new AudioError(
            `Invalid base64 data${context ? ` for ${context}` : ''}`,
            'INVALID_BASE64',
            context
        );
    }

    try {
        return window.atob(base64);
    } catch (error) {
        // atob throws DOMException for invalid characters
        throw new AudioError(
            `Failed to decode base64${context ? ` for ${context}` : ''}`,
            'INVALID_BASE64',
            context,
            error instanceof Error ? error : undefined
        );
    }
}

/**
 * Converts a binary string to a Uint8Array.
 */
function binaryStringToBytes(binaryString: string): Uint8Array {
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/**
 * Converts a base64-encoded string to a Blob.
 * @param base64 - The base64-encoded audio content
 * @param mimeType - The MIME type for the blob (default: 'audio/wav')
 * @param context - Optional context for error messages (e.g., instrument name)
 * @returns A Blob containing the decoded audio data
 * @throws AudioError if base64 is invalid
 */
export function base64ToBlob(
    base64: string,
    mimeType: string = 'audio/wav',
    context?: string
): Blob {
    const binaryString = safeAtob(base64, context);
    const bytes = binaryStringToBytes(binaryString);
    return new Blob([bytes], { type: mimeType });
}

/**
 * Converts a base64-encoded string to a Blob URL for playback.
 * @param base64 - The base64-encoded audio content
 * @param mimeType - The MIME type for the blob (default: 'audio/wav')
 * @param context - Optional context for error messages (e.g., instrument name)
 * @returns A blob URL that can be used as an audio source
 * @throws AudioError if base64 is invalid
 * @note Remember to call URL.revokeObjectURL() when done to prevent memory leaks
 */
export function base64ToBlobUrl(
    base64: string,
    mimeType: string = 'audio/wav',
    context?: string
): string {
    const blob = base64ToBlob(base64, mimeType, context);
    return URL.createObjectURL(blob);
}

/**
 * Converts a base64-encoded string to an ArrayBuffer for Web Audio API.
 * @param base64 - The base64-encoded audio content
 * @param context - Optional context for error messages (e.g., instrument name)
 * @returns An ArrayBuffer for use with AudioContext.decodeAudioData()
 * @throws AudioError if base64 is invalid
 */
export function base64ToArrayBuffer(base64: string, context?: string): ArrayBuffer {
    const binaryString = safeAtob(base64, context);
    const bytes = binaryStringToBytes(binaryString);
    // Return a copy of the buffer to avoid issues with the underlying view
    return bytes.buffer.slice(0);
}
