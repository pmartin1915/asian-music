import { httpsCallable } from 'firebase/functions';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getApp, getApps, initializeApp } from 'firebase/app';
import type { CompositionParams, Composition, AudioResult, PentatonicMode, Mood } from '../types/music';
import { ApiError, mapFirebaseError } from '../types/errors';
import { withRetry } from '../utils/retry';
import { API_TIMEOUTS, RETRY } from '../config/constants';

/** Request payload for the generate audio endpoint */
interface GenerateAudioRequest {
    composition: Composition;
    instrument: string;
    mode: PentatonicMode;
    tempo: number;
    mood: Mood;
    seed?: number;
}

// Initialize Firebase with environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const functions = getFunctions(app);

// Use emulator if in dev mode
if (import.meta.env.DEV) {
    connectFunctionsEmulator(functions, "localhost", 5001);
}

/**
 * Composes a musical structure using Gemini AI.
 * Includes automatic retry for transient failures.
 *
 * @param params - Composition parameters (mode, tempo, instruments, mood)
 * @returns The generated composition structure
 * @throws ApiError with typed error code
 */
export const composeMusic = async (params: CompositionParams): Promise<Composition> => {
    const compose = httpsCallable<CompositionParams, Composition>(
        functions,
        'compose',
        { timeout: API_TIMEOUTS.COMPOSE }
    );

    try {
        const result = await withRetry(
            () => compose(params),
            {
                maxAttempts: RETRY.MAX_ATTEMPTS,
                baseDelayMs: RETRY.BASE_DELAY_MS,
                maxDelayMs: RETRY.MAX_DELAY_MS,
                shouldRetry: (err) => {
                    const apiErr = mapFirebaseError(err);
                    return apiErr.retryable;
                },
                onRetry: (err, attempt, delay) => {
                    console.log(`[API] Compose retry ${attempt}, waiting ${delay}ms...`, err);
                },
            }
        );
        return result.data;
    } catch (error) {
        // Convert to typed ApiError if not already
        if (error instanceof ApiError) {
            throw error;
        }
        throw mapFirebaseError(error);
    }
};

/**
 * Generates audio for a specific instrument using Lyria AI.
 * Includes automatic retry for transient failures.
 *
 * @param composition - The composition structure from composeMusic
 * @param instrument - The instrument to synthesize
 * @param context - Original composition parameters for context
 * @returns The generated audio result with base64 content
 * @throws ApiError with typed error code
 */
export const generateAudio = async (
    composition: Composition,
    instrument: string,
    context: CompositionParams
): Promise<AudioResult> => {
    const generate = httpsCallable<GenerateAudioRequest, AudioResult>(
        functions,
        'generate',
        { timeout: API_TIMEOUTS.GENERATE }
    );

    try {
        const result = await withRetry(
            () => generate({
                composition,
                instrument,
                mode: context.mode,
                tempo: context.tempo,
                mood: context.mood,
                seed: context.seed,
            }),
            {
                maxAttempts: RETRY.MAX_ATTEMPTS,
                baseDelayMs: RETRY.BASE_DELAY_MS,
                maxDelayMs: RETRY.MAX_DELAY_MS,
                shouldRetry: (err) => {
                    const apiErr = mapFirebaseError(err);
                    return apiErr.retryable;
                },
                onRetry: (err, attempt, delay) => {
                    console.log(`[API] Generate ${instrument} retry ${attempt}, waiting ${delay}ms...`, err);
                },
            }
        );

        // Validate response has audio content
        if (!result.data.audioContent) {
            throw new ApiError(
                `No audio content received for ${instrument}`,
                'SERVER_ERROR',
                true // Retryable - server issue
            );
        }

        return result.data;
    } catch (error) {
        // Convert to typed ApiError if not already
        if (error instanceof ApiError) {
            throw error;
        }
        throw mapFirebaseError(error);
    }
};
