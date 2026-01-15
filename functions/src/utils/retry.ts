/**
 * Retry utility for transient failures with exponential backoff.
 */

export interface RetryOptions {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    jitter?: number;
    shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    jitter: 0.3,
    shouldRetry: () => true,
};

/**
 * Check if an error is transient and should be retried.
 */
export function isTransientError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const err = error as { code?: string; status?: number; message?: string };

    // Rate limiting
    if (err.code === 'RESOURCE_EXHAUSTED' || err.status === 429) return true;

    // Server errors (5xx)
    if (err.status && err.status >= 500 && err.status < 600) return true;

    // Timeout errors
    if (err.code === 'DEADLINE_EXCEEDED' || err.message?.includes('timeout')) return true;

    // Network errors
    if (err.code === 'UNAVAILABLE' || err.message?.includes('network')) return true;

    return false;
}

/**
 * Sleep for a given duration.
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter.
 */
function calculateDelay(
    attempt: number,
    baseDelayMs: number,
    maxDelayMs: number,
    jitter: number
): number {
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
    const jitterAmount = cappedDelay * jitter * (Math.random() * 2 - 1);
    return Math.max(0, cappedDelay + jitterAmount);
}

/**
 * Execute a function with retry logic.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: unknown;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            const isLastAttempt = attempt === opts.maxAttempts;
            const shouldRetry = opts.shouldRetry(error);

            if (isLastAttempt || !shouldRetry) {
                throw error;
            }

            const delay = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs, opts.jitter);
            await sleep(delay);
        }
    }

    throw lastError;
}
