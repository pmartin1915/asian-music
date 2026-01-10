/**
 * Validation utilities for runtime type checking.
 * Provides type guards for data loaded from localStorage and other external sources.
 */

import type { CompositionParams, Composition, InstrumentAudioResult } from '../types/music';

/** Structure of a saved composition in localStorage */
export interface SavedComposition {
    id: string;
    params: CompositionParams;
    composition: Composition;
    audioResults: InstrumentAudioResult[];
    createdAt: number;
}

/**
 * Type guard to validate a single saved composition object.
 * Checks that all required fields exist and have the correct types.
 */
export function isValidSavedComposition(data: unknown): data is SavedComposition {
    if (!data || typeof data !== 'object') return false;

    const obj = data as Record<string, unknown>;

    return (
        typeof obj.id === 'string' &&
        typeof obj.params === 'object' && obj.params !== null &&
        typeof obj.composition === 'object' && obj.composition !== null &&
        Array.isArray(obj.audioResults) &&
        typeof obj.createdAt === 'number'
    );
}

/**
 * Validates an array of saved compositions from localStorage.
 * Filters out any invalid entries to prevent runtime errors.
 * @param data - Raw data parsed from localStorage
 * @returns Array of valid SavedComposition objects
 */
export function validateHistoryData(data: unknown): SavedComposition[] {
    if (!Array.isArray(data)) return [];
    return data.filter(isValidSavedComposition);
}
