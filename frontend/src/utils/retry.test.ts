import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, createRetryWrapper, DEFAULT_RETRY_CONFIG } from './retry';
import { ApiError } from '../types/errors';

describe('Retry Utility', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('withRetry', () => {
        it('returns result on first success', async () => {
            const fn = vi.fn().mockResolvedValue('success');

            const promise = withRetry(fn);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('retries on retryable error', async () => {
            const retryableError = new ApiError('Timeout', 'TIMEOUT', true);
            const fn = vi.fn()
                .mockRejectedValueOnce(retryableError)
                .mockResolvedValue('success');

            const promise = withRetry(fn);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('throws immediately for non-retryable error', async () => {
            const nonRetryableError = new ApiError('Bad request', 'VALIDATION_ERROR', false);
            const fn = vi.fn().mockRejectedValue(nonRetryableError);

            const promise = withRetry(fn);

            await expect(promise).rejects.toThrow(nonRetryableError);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('calls onRetry callback before each retry', async () => {
            const retryableError = new ApiError('Timeout', 'TIMEOUT', true);
            const fn = vi.fn()
                .mockRejectedValueOnce(retryableError)
                .mockRejectedValueOnce(retryableError)
                .mockResolvedValue('success');

            const onRetry = vi.fn();

            const promise = withRetry(fn, { onRetry });
            await vi.runAllTimersAsync();
            await promise;

            expect(onRetry).toHaveBeenCalledTimes(2);
            expect(onRetry).toHaveBeenCalledWith(retryableError, 1, expect.any(Number));
            expect(onRetry).toHaveBeenCalledWith(retryableError, 2, expect.any(Number));
        });

        it('gives up after maxAttempts', async () => {
            const retryableError = new ApiError('Timeout', 'TIMEOUT', true);
            const fn = vi.fn().mockRejectedValue(retryableError);

            const promise = withRetry(fn, { maxAttempts: 3 }).catch(() => {});
            await vi.runAllTimersAsync();
            await promise;

            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('respects custom maxAttempts', async () => {
            const retryableError = new ApiError('Timeout', 'TIMEOUT', true);
            const fn = vi.fn().mockRejectedValue(retryableError);

            const promise = withRetry(fn, { maxAttempts: 5 }).catch(() => {});
            await vi.runAllTimersAsync();
            await promise;

            expect(fn).toHaveBeenCalledTimes(5);
        });
    });

    describe('Exponential Backoff', () => {
        it('delays increase exponentially: 1s, 2s, 4s...', async () => {
            const retryableError = new ApiError('Timeout', 'TIMEOUT', true);
            const fn = vi.fn().mockRejectedValue(retryableError);

            const delays: number[] = [];
            const onRetry = vi.fn((_, __, delay) => delays.push(delay));

            // Mock Math.random to return 0 (no jitter) for predictable delays
            vi.spyOn(Math, 'random').mockReturnValue(0);

            // Use small delays for fast testing but verify exponential pattern
            const promise = withRetry(fn, {
                maxAttempts: 4,
                baseDelayMs: 10, // Use small values to avoid timeout
                maxDelayMs: 1000,
                onRetry,
            }).catch(() => {});
            await vi.runAllTimersAsync();
            await promise;

            // Delays should be 10, 20, 40 (exponential pattern)
            expect(delays[0]).toBe(10);
            expect(delays[1]).toBe(20);
            expect(delays[2]).toBe(40);

            vi.restoreAllMocks();
        });

        it('delays are capped at maxDelayMs', async () => {
            const retryableError = new ApiError('Timeout', 'TIMEOUT', true);
            const fn = vi.fn().mockRejectedValue(retryableError);

            const delays: number[] = [];
            const onRetry = vi.fn((_, __, delay) => delays.push(delay));

            vi.spyOn(Math, 'random').mockReturnValue(0);

            const promise = withRetry(fn, {
                maxAttempts: 5,
                baseDelayMs: 10, // Use small values to avoid timeout
                maxDelayMs: 50, // Cap at 50ms
                onRetry,
            }).catch(() => {});
            await vi.runAllTimersAsync();
            await promise;

            // 10, 20, 40, 50 (capped at maxDelayMs)
            expect(delays[0]).toBe(10);
            expect(delays[1]).toBe(20);
            expect(delays[2]).toBe(40);
            expect(delays[3]).toBeLessThanOrEqual(50);

            vi.restoreAllMocks();
        });

        it('jitter adds 0-30% randomness', async () => {
            const retryableError = new ApiError('Timeout', 'TIMEOUT', true);
            const fn = vi.fn().mockRejectedValue(retryableError);

            const delays: number[] = [];
            const onRetry = vi.fn((_, __, delay) => delays.push(delay));

            // Max jitter (30%)
            vi.spyOn(Math, 'random').mockReturnValue(1);

            const promise = withRetry(fn, {
                maxAttempts: 2,
                baseDelayMs: 100, // Use small values to avoid timeout
                maxDelayMs: 1000,
                onRetry,
            }).catch(() => {});
            await vi.runAllTimersAsync();
            await promise;

            // With max jitter (30%), 100 becomes 130
            expect(delays[0]).toBe(130);

            vi.restoreAllMocks();
        });
    });

    describe('shouldRetry Logic', () => {
        it('retries ApiError with retryable=true', async () => {
            const retryableError = new ApiError('Server error', 'SERVER_ERROR', true);
            const fn = vi.fn()
                .mockRejectedValueOnce(retryableError)
                .mockResolvedValue('success');

            const promise = withRetry(fn);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('does not retry ApiError with retryable=false', async () => {
            const nonRetryableError = new ApiError('Bad request', 'VALIDATION_ERROR', false);
            const fn = vi.fn().mockRejectedValue(nonRetryableError);

            await expect(withRetry(fn)).rejects.toThrow(nonRetryableError);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('retries network TypeError', async () => {
            const networkError = new TypeError('network error');
            const fn = vi.fn()
                .mockRejectedValueOnce(networkError)
                .mockResolvedValue('success');

            const promise = withRetry(fn);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('does not retry regular TypeError', async () => {
            const regularError = new TypeError('undefined is not a function');
            const fn = vi.fn().mockRejectedValue(regularError);

            await expect(withRetry(fn)).rejects.toThrow(regularError);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('accepts custom shouldRetry function', async () => {
            const error = new Error('Custom error');
            const fn = vi.fn()
                .mockRejectedValueOnce(error)
                .mockResolvedValue('success');

            const customShouldRetry = vi.fn().mockReturnValue(true);

            const promise = withRetry(fn, { shouldRetry: customShouldRetry });
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result).toBe('success');
            expect(customShouldRetry).toHaveBeenCalledWith(error, 1);
        });
    });

    describe('createRetryWrapper', () => {
        it('creates reusable retry function', async () => {
            const apiRetry = createRetryWrapper({ maxAttempts: 2 });
            const fn = vi.fn().mockResolvedValue('result');

            const promise = apiRetry(fn);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result).toBe('result');
        });

        it('allows config overrides', async () => {
            const retryableError = new ApiError('Timeout', 'TIMEOUT', true);
            const fn = vi.fn().mockRejectedValue(retryableError);

            const baseWrapper = createRetryWrapper({ maxAttempts: 2 });

            const promise = baseWrapper(fn, { maxAttempts: 4 }).catch(() => {});
            await vi.runAllTimersAsync();
            await promise;

            // Override should take precedence
            expect(fn).toHaveBeenCalledTimes(4);
        });

        it('merges with default config', async () => {
            const retryableError = new ApiError('Timeout', 'TIMEOUT', true);
            const fn = vi.fn().mockRejectedValue(retryableError);

            // Only override maxAttempts, other defaults should apply
            const wrapper = createRetryWrapper({ maxAttempts: 2 });
            const promise = wrapper(fn).catch(() => {});
            await vi.runAllTimersAsync();
            await promise;

            expect(fn).toHaveBeenCalledTimes(2);
        });
    });

    describe('DEFAULT_RETRY_CONFIG', () => {
        it('has expected default values', () => {
            expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(3);
            expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(1000);
            expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(10000);
            expect(typeof DEFAULT_RETRY_CONFIG.shouldRetry).toBe('function');
        });
    });
});
