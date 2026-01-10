// Retry utility with exponential backoff for transient failures

import { ApiError } from '../types/errors';

export interface RetryConfig {
    /** Maximum number of retry attempts */
    maxAttempts: number;
    /** Base delay in milliseconds before first retry */
    baseDelayMs: number;
    /** Maximum delay cap in milliseconds */
    maxDelayMs: number;
    /** Function to determine if error should trigger retry */
    shouldRetry: (error: unknown, attempt: number) => boolean;
    /** Optional callback when retry is about to happen */
    onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    shouldRetry: (error) => {
        // Retry ApiErrors that are marked retryable
        if (error instanceof ApiError) {
            return error.retryable;
        }
        // Retry network errors by default (TypeError for fetch failures)
        if (error instanceof TypeError && error.message.includes('network')) {
            return true;
        }
        return false;
    },
};

/**
 * Calculates delay with exponential backoff and jitter.
 * Jitter prevents thundering herd when multiple clients retry simultaneously.
 */
function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
    // Exponential: 1s, 2s, 4s, 8s...
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
    // Add random jitter (0-30% of delay)
    const jitter = Math.random() * 0.3 * exponentialDelay;
    // Cap at maximum
    return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Executes an async function with exponential backoff retry.
 *
 * @param fn - The async function to execute
 * @param config - Partial retry configuration (merged with defaults)
 * @returns The result of the function
 * @throws The last error if all retries exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetchData(),
 *   {
 *     maxAttempts: 3,
 *     onRetry: (err, attempt) => console.log(`Retry ${attempt}...`),
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    const mergedConfig: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        ...config,
    };

    const { maxAttempts, baseDelayMs, maxDelayMs, shouldRetry, onRetry } = mergedConfig;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry if this was the last attempt or error is not retryable
            if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
                throw error;
            }

            // Calculate delay with backoff and jitter
            const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs);

            // Notify caller about retry
            onRetry?.(error, attempt, delay);

            // Wait before next attempt
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    // Should not reach here, but TypeScript needs this
    throw lastError;
}

/**
 * Creates a retry wrapper with preset configuration.
 * Useful for creating reusable retry strategies.
 *
 * @example
 * ```typescript
 * const apiRetry = createRetryWrapper({ maxAttempts: 2 });
 * const result = await apiRetry(() => callApi());
 * ```
 */
export function createRetryWrapper(config: Partial<RetryConfig> = {}) {
    return <T>(fn: () => Promise<T>, overrides: Partial<RetryConfig> = {}): Promise<T> => {
        return withRetry(fn, { ...config, ...overrides });
    };
}
