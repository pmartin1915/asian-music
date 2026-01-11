import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGeneration } from './useGeneration';
import { mockComposition, mockParams, mockAudioResult } from '../test/utils';
import { ApiError, GenerationError } from '../types/errors';
import type { Instrument } from '../types/music';

// Mock the API module
vi.mock('../services/api', () => ({
    composeMusic: vi.fn(),
    generateAudio: vi.fn(),
}));

import { composeMusic, generateAudio } from '../services/api';

const mockedComposeMusic = composeMusic as ReturnType<typeof vi.fn>;
const mockedGenerateAudio = generateAudio as ReturnType<typeof vi.fn>;

describe('useGeneration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Initial State', () => {
        it('returns initial state with pending status', () => {
            const { result } = renderHook(() => useGeneration());

            expect(result.current.status).toBe('pending');
            expect(result.current.isGenerating).toBe(false);
            expect(result.current.composition).toBeNull();
            expect(result.current.audioResults).toEqual([]);
            expect(result.current.error).toBeNull();
            expect(result.current.failedInstruments).toEqual([]);
            expect(result.current.canRetryFailed).toBe(false);
        });

        it('has empty steps array initially', () => {
            const { result } = renderHook(() => useGeneration());

            expect(result.current.steps).toEqual([]);
            expect(result.current.totalSteps).toBe(0);
        });
    });

    describe('generate()', () => {
        it('sets status to composing when starting', async () => {
            mockedComposeMusic.mockImplementation(() => new Promise(() => {})); // Never resolves

            const { result } = renderHook(() => useGeneration());

            act(() => {
                result.current.generate(mockParams);
            });

            expect(result.current.isGenerating).toBe(true);
            expect(result.current.status).toBe('composing');
        });

        it('calls composeMusic with params', async () => {
            mockedComposeMusic.mockResolvedValue(mockComposition);
            mockedGenerateAudio.mockResolvedValue(mockAudioResult);

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await result.current.generate(mockParams);
            });

            expect(mockedComposeMusic).toHaveBeenCalledWith(mockParams);
        });

        it('calls generateAudio for each instrument', async () => {
            const params = { ...mockParams, instruments: ['erhu', 'guzheng'] as Instrument[] };
            mockedComposeMusic.mockResolvedValue(mockComposition);
            mockedGenerateAudio.mockResolvedValue(mockAudioResult);

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await result.current.generate(params);
            });

            expect(mockedGenerateAudio).toHaveBeenCalledTimes(2);
            expect(mockedGenerateAudio).toHaveBeenCalledWith(mockComposition, 'erhu', params);
            expect(mockedGenerateAudio).toHaveBeenCalledWith(mockComposition, 'guzheng', params);
        });

        it('updates audioResults as instruments complete', async () => {
            const params = { ...mockParams, instruments: ['erhu'] as Instrument[] };
            mockedComposeMusic.mockResolvedValue(mockComposition);
            mockedGenerateAudio.mockResolvedValue(mockAudioResult);

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await result.current.generate(params);
            });

            expect(result.current.audioResults).toHaveLength(1);
            expect(result.current.audioResults[0].instrument).toBe('erhu');
        });

        it('sets status to complete when all succeed', async () => {
            mockedComposeMusic.mockResolvedValue(mockComposition);
            mockedGenerateAudio.mockResolvedValue(mockAudioResult);

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await result.current.generate(mockParams);
            });

            expect(result.current.status).toBe('complete');
            expect(result.current.isGenerating).toBe(false);
            expect(result.current.currentStep).toBe('Complete');
        });

        it('returns composition and audioResults on success', async () => {
            mockedComposeMusic.mockResolvedValue(mockComposition);
            mockedGenerateAudio.mockResolvedValue(mockAudioResult);

            const { result } = renderHook(() => useGeneration());

            let returnValue: unknown;
            await act(async () => {
                returnValue = await result.current.generate(mockParams);
            });

            expect(returnValue).toEqual({
                composition: mockComposition,
                audioResults: expect.arrayContaining([
                    expect.objectContaining({ instrument: 'erhu' }),
                    expect.objectContaining({ instrument: 'guzheng' }),
                ]),
            });
        });

        it('builds steps correctly for compose + instruments', async () => {
            mockedComposeMusic.mockResolvedValue(mockComposition);
            mockedGenerateAudio.mockResolvedValue(mockAudioResult);

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await result.current.generate(mockParams);
            });

            // Should have 3 steps: compose + erhu + guzheng
            expect(result.current.totalSteps).toBe(3);
            expect(result.current.steps[0].name).toBe('Composing structure');
            expect(result.current.steps[1].name).toBe('Synthesizing erhu');
            expect(result.current.steps[2].name).toBe('Synthesizing guzheng');
        });
    });

    describe('Abort Handling', () => {
        it('stops generation when abort() is called', async () => {
            mockedComposeMusic.mockImplementation(async () => {
                await new Promise((r) => setTimeout(r, 100));
                return mockComposition;
            });

            const { result } = renderHook(() => useGeneration());

            act(() => {
                result.current.generate(mockParams);
            });

            await act(async () => {
                result.current.abort();
                await new Promise((r) => setTimeout(r, 150));
            });

            expect(result.current.status).toBe('pending');
            expect(result.current.isGenerating).toBe(false);
        });

        it('resets state after abort', async () => {
            mockedComposeMusic.mockImplementation(async () => {
                await new Promise((r) => setTimeout(r, 50));
                return mockComposition;
            });

            const { result } = renderHook(() => useGeneration());

            act(() => {
                result.current.generate(mockParams);
            });

            await act(async () => {
                result.current.abort();
                await new Promise((r) => setTimeout(r, 100));
            });

            expect(result.current.composition).toBeNull();
            expect(result.current.audioResults).toEqual([]);
            expect(result.current.steps).toEqual([]);
        });
    });

    describe('Partial Success', () => {
        it('continues when single instrument fails', async () => {
            const params = { ...mockParams, instruments: ['erhu', 'guzheng'] as Instrument[] };
            mockedComposeMusic.mockResolvedValue(mockComposition);
            mockedGenerateAudio
                .mockResolvedValueOnce(mockAudioResult) // erhu succeeds
                .mockRejectedValueOnce(new Error('Guzheng failed')); // guzheng fails

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await result.current.generate(params);
            });

            expect(result.current.status).toBe('complete');
            expect(result.current.audioResults).toHaveLength(1);
            expect(result.current.audioResults[0].instrument).toBe('erhu');
        });

        it('sets canRetryFailed to true on partial failure', async () => {
            const params = { ...mockParams, instruments: ['erhu', 'guzheng'] as Instrument[] };
            mockedComposeMusic.mockResolvedValue(mockComposition);
            mockedGenerateAudio
                .mockResolvedValueOnce(mockAudioResult)
                .mockRejectedValueOnce(new Error('Failed'));

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await result.current.generate(params);
            });

            expect(result.current.canRetryFailed).toBe(true);
            expect(result.current.currentStep).toBe('Partial Success');
        });

        it('tracks failedInstruments array', async () => {
            const params = { ...mockParams, instruments: ['erhu', 'guzheng'] as Instrument[] };
            mockedComposeMusic.mockResolvedValue(mockComposition);
            mockedGenerateAudio
                .mockResolvedValueOnce(mockAudioResult)
                .mockRejectedValueOnce(new Error('Failed'));

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await result.current.generate(params);
            });

            expect(result.current.failedInstruments).toEqual(['guzheng']);
        });

        it('throws GenerationError when all instruments fail', async () => {
            const params = { ...mockParams, instruments: ['erhu'] as Instrument[] };
            mockedComposeMusic.mockResolvedValue(mockComposition);
            mockedGenerateAudio.mockRejectedValue(new Error('All failed'));

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await expect(result.current.generate(params)).rejects.toThrow(GenerationError);
            });

            expect(result.current.status).toBe('error');
            expect(result.current.canRetryFailed).toBe(true);
        });
    });

    describe('retryFailed()', () => {
        it('retries only failed instruments', async () => {
            const params = { ...mockParams, instruments: ['erhu', 'guzheng'] as Instrument[] };
            mockedComposeMusic.mockResolvedValue(mockComposition);
            mockedGenerateAudio
                .mockResolvedValueOnce(mockAudioResult)
                .mockRejectedValueOnce(new Error('Failed'));

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await result.current.generate(params);
            });

            // Now retry
            mockedGenerateAudio.mockResolvedValue(mockAudioResult);

            await act(async () => {
                await result.current.retryFailed();
            });

            // Should have called generateAudio for guzheng only
            expect(mockedGenerateAudio).toHaveBeenLastCalledWith(
                mockComposition,
                'guzheng',
                params
            );
        });

        it('uses existing composition without re-composing', async () => {
            const params = { ...mockParams, instruments: ['erhu', 'guzheng'] as Instrument[] };
            mockedComposeMusic.mockResolvedValue(mockComposition);
            mockedGenerateAudio
                .mockResolvedValueOnce(mockAudioResult)
                .mockRejectedValueOnce(new Error('Failed'));

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await result.current.generate(params);
            });

            const composeCallsBefore = mockedComposeMusic.mock.calls.length;

            mockedGenerateAudio.mockResolvedValue(mockAudioResult);

            await act(async () => {
                await result.current.retryFailed();
            });

            // Compose should not have been called again
            expect(mockedComposeMusic).toHaveBeenCalledTimes(composeCallsBefore);
        });

        it('updates audioResults with successful retries', async () => {
            const params = { ...mockParams, instruments: ['erhu', 'guzheng'] as Instrument[] };
            mockedComposeMusic.mockResolvedValue(mockComposition);
            mockedGenerateAudio
                .mockResolvedValueOnce(mockAudioResult)
                .mockRejectedValueOnce(new Error('Failed'));

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await result.current.generate(params);
            });

            expect(result.current.audioResults).toHaveLength(1);

            mockedGenerateAudio.mockResolvedValue(mockAudioResult);

            await act(async () => {
                await result.current.retryFailed();
            });

            expect(result.current.audioResults).toHaveLength(2);
        });

        it('clears canRetryFailed when all succeed', async () => {
            const params = { ...mockParams, instruments: ['erhu', 'guzheng'] as Instrument[] };
            mockedComposeMusic.mockResolvedValue(mockComposition);
            mockedGenerateAudio
                .mockResolvedValueOnce(mockAudioResult)
                .mockRejectedValueOnce(new Error('Failed'));

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await result.current.generate(params);
            });

            expect(result.current.canRetryFailed).toBe(true);

            mockedGenerateAudio.mockResolvedValue(mockAudioResult);

            await act(async () => {
                await result.current.retryFailed();
            });

            expect(result.current.canRetryFailed).toBe(false);
            expect(result.current.failedInstruments).toEqual([]);
        });

        it('returns empty array when no composition exists', async () => {
            const { result } = renderHook(() => useGeneration());

            let retried: unknown;
            await act(async () => {
                retried = await result.current.retryFailed();
            });

            expect(retried).toEqual([]);
        });
    });

    describe('Error Handling', () => {
        it('wraps unknown errors as ApiError', async () => {
            mockedComposeMusic.mockRejectedValue(new Error('Unknown error'));

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await expect(result.current.generate(mockParams)).rejects.toThrow(ApiError);
            });

            expect(result.current.error).toBeInstanceOf(ApiError);
            expect(result.current.error?.message).toBe('Unknown error');
        });

        it('preserves typed ApiError', async () => {
            const apiError = new ApiError('Server error', 'SERVER_ERROR', true, 500);
            mockedComposeMusic.mockRejectedValue(apiError);

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await expect(result.current.generate(mockParams)).rejects.toThrow(ApiError);
            });

            expect(result.current.error).toBe(apiError);
            expect(result.current.error?.code).toBe('SERVER_ERROR');
        });

        it('preserves typed GenerationError', async () => {
            const genError = new GenerationError('Gen failed', 'GENERATION_FAILED', true);
            mockedComposeMusic.mockRejectedValue(genError);

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await expect(result.current.generate(mockParams)).rejects.toThrow(GenerationError);
            });

            expect(result.current.error).toBe(genError);
        });

        it('sets error in state on failure', async () => {
            mockedComposeMusic.mockRejectedValue(new Error('Failed'));

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                try {
                    await result.current.generate(mockParams);
                } catch {
                    // Expected
                }
            });

            expect(result.current.status).toBe('error');
            expect(result.current.error).not.toBeNull();
            expect(result.current.currentStep).toBe('Error');
        });
    });

    describe('reset()', () => {
        it('resets state to initial values', async () => {
            mockedComposeMusic.mockResolvedValue(mockComposition);
            mockedGenerateAudio.mockResolvedValue(mockAudioResult);

            const { result } = renderHook(() => useGeneration());

            await act(async () => {
                await result.current.generate(mockParams);
            });

            expect(result.current.composition).not.toBeNull();

            act(() => {
                result.current.reset();
            });

            expect(result.current.status).toBe('pending');
            expect(result.current.composition).toBeNull();
            expect(result.current.audioResults).toEqual([]);
            expect(result.current.isGenerating).toBe(false);
        });
    });
});
