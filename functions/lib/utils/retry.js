"use strict";
/**
 * Retry utility for transient failures with exponential backoff.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTransientError = isTransientError;
exports.withRetry = withRetry;
const DEFAULT_OPTIONS = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    jitter: 0.3,
    shouldRetry: () => true,
};
/**
 * Check if an error is transient and should be retried.
 */
function isTransientError(error) {
    var _a, _b;
    if (!error || typeof error !== 'object')
        return false;
    const err = error;
    // Rate limiting
    if (err.code === 'RESOURCE_EXHAUSTED' || err.status === 429)
        return true;
    // Server errors (5xx)
    if (err.status && err.status >= 500 && err.status < 600)
        return true;
    // Timeout errors
    if (err.code === 'DEADLINE_EXCEEDED' || ((_a = err.message) === null || _a === void 0 ? void 0 : _a.includes('timeout')))
        return true;
    // Network errors
    if (err.code === 'UNAVAILABLE' || ((_b = err.message) === null || _b === void 0 ? void 0 : _b.includes('network')))
        return true;
    return false;
}
/**
 * Sleep for a given duration.
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Calculate delay with exponential backoff and jitter.
 */
function calculateDelay(attempt, baseDelayMs, maxDelayMs, jitter) {
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
    const jitterAmount = cappedDelay * jitter * (Math.random() * 2 - 1);
    return Math.max(0, cappedDelay + jitterAmount);
}
/**
 * Execute a function with retry logic.
 */
async function withRetry(fn, options = {}) {
    const opts = Object.assign(Object.assign({}, DEFAULT_OPTIONS), options);
    let lastError;
    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
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
//# sourceMappingURL=retry.js.map