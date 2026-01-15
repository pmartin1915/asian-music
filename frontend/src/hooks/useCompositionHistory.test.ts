import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { CompositionParams, Composition, InstrumentAudioResult } from '../types/music';
import { STORAGE } from '../config/constants';

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock validateHistoryData
vi.mock('../utils/validation', () => ({
    validateHistoryData: vi.fn((data) => data),
}));

import { useCompositionHistory } from './useCompositionHistory';
import type { SavedComposition } from './useCompositionHistory';
import { validateHistoryData } from '../utils/validation';

const mockedValidateHistoryData = vi.mocked(validateHistoryData);

// Helper to create mock composition params
const createMockParams = (overrides?: Partial<CompositionParams>): CompositionParams => ({
    mode: 'gong',
    root: 'C',
    tempo: 72,
    instruments: ['erhu'],
    mood: 'calm',
    ...overrides,
});

// Helper to create mock composition
const createMockComposition = (): Composition => ({
    scale: ['C', 'D', 'E', 'G', 'A'],
    motif: { pitches: ['C', 'E', 'G'], rhythm: [1, 0.5, 0.5] },
    form: ['A', 'B', 'A'],
    instrumentRoles: { erhu: 'melody' },
    euclideanPatterns: { erhu: [1, 0, 1, 0] },
});

// Helper to create mock audio results
const createMockAudioResults = (): InstrumentAudioResult[] => [
    { instrument: 'erhu', audioContent: 'YQ==', mimeType: 'audio/wav', seed: 12345 },
];

// Helper to create a saved composition
const createMockSavedComposition = (id: string, createdAt?: number): SavedComposition => ({
    id,
    params: createMockParams(),
    composition: createMockComposition(),
    audioResults: createMockAudioResults(),
    createdAt: createdAt || Date.now(),
});

describe('useCompositionHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.getItem.mockReturnValue(null);
        mockedValidateHistoryData.mockImplementation((data) => data as SavedComposition[]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initial State', () => {
        it('returns empty history array initially', () => {
            const { result } = renderHook(() => useCompositionHistory());

            expect(result.current.history).toEqual([]);
        });

        it('provides all CRUD functions', () => {
            const { result } = renderHook(() => useCompositionHistory());

            expect(typeof result.current.saveComposition).toBe('function');
            expect(typeof result.current.deleteComposition).toBe('function');
            expect(typeof result.current.clearHistory).toBe('function');
            expect(typeof result.current.getComposition).toBe('function');
        });
    });

    describe('Load from localStorage', () => {
        it('loads valid history from localStorage on mount', async () => {
            const existingHistory = [createMockSavedComposition('comp_1')];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(existingHistory));

            const { result } = renderHook(() => useCompositionHistory());

            await waitFor(() => {
                expect(result.current.history).toHaveLength(1);
            });
            expect(result.current.history[0].id).toBe('comp_1');
        });

        it('handles empty localStorage gracefully', () => {
            localStorageMock.getItem.mockReturnValue(null);

            const { result } = renderHook(() => useCompositionHistory());

            expect(result.current.history).toEqual([]);
        });

        it('handles invalid JSON in localStorage', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            localStorageMock.getItem.mockReturnValue('not valid json{{{');

            const { result } = renderHook(() => useCompositionHistory());

            expect(result.current.history).toEqual([]);
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('filters out invalid entries via validateHistoryData', async () => {
            const mixedData = [
                createMockSavedComposition('valid_1'),
                { invalid: 'entry' },
                createMockSavedComposition('valid_2'),
            ];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(mixedData));
            mockedValidateHistoryData.mockReturnValue([
                createMockSavedComposition('valid_1'),
                createMockSavedComposition('valid_2'),
            ]);

            const { result } = renderHook(() => useCompositionHistory());

            await waitFor(() => {
                expect(result.current.history).toHaveLength(2);
            });
        });

        it('logs error when localStorage.getItem throws', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            localStorageMock.getItem.mockImplementation(() => {
                throw new Error('localStorage disabled');
            });

            const { result } = renderHook(() => useCompositionHistory());

            expect(result.current.history).toEqual([]);
            expect(consoleSpy).toHaveBeenCalled();
        });
    });

    describe('saveComposition()', () => {
        it('adds composition to history', () => {
            const { result } = renderHook(() => useCompositionHistory());

            act(() => {
                result.current.saveComposition(
                    createMockParams(),
                    createMockComposition(),
                    createMockAudioResults()
                );
            });

            expect(result.current.history).toHaveLength(1);
        });

        it('generates unique id with comp_ prefix', () => {
            const { result } = renderHook(() => useCompositionHistory());

            act(() => {
                result.current.saveComposition(
                    createMockParams(),
                    createMockComposition(),
                    createMockAudioResults()
                );
            });

            expect(result.current.history[0].id).toMatch(/^comp_\d+_[a-z0-9]+$/);
        });

        it('sets createdAt timestamp', () => {
            const now = Date.now();
            const { result } = renderHook(() => useCompositionHistory());

            act(() => {
                result.current.saveComposition(
                    createMockParams(),
                    createMockComposition(),
                    createMockAudioResults()
                );
            });

            expect(result.current.history[0].createdAt).toBeGreaterThanOrEqual(now);
            expect(result.current.history[0].createdAt).toBeLessThanOrEqual(now + 1000);
        });

        it('prepends new composition (newest first)', () => {
            const existingHistory = [createMockSavedComposition('old_comp')];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(existingHistory));

            const { result } = renderHook(() => useCompositionHistory());

            act(() => {
                result.current.saveComposition(
                    createMockParams({ mode: 'shang' }),
                    createMockComposition(),
                    createMockAudioResults()
                );
            });

            expect(result.current.history[0].params.mode).toBe('shang');
            expect(result.current.history[1].id).toBe('old_comp');
        });

        it('limits history to MAX_HISTORY items', async () => {
            // Create MAX_HISTORY existing items
            const existingHistory = Array.from({ length: STORAGE.MAX_HISTORY }, (_, i) =>
                createMockSavedComposition(`comp_${i}`)
            );
            localStorageMock.getItem.mockReturnValue(JSON.stringify(existingHistory));

            const { result } = renderHook(() => useCompositionHistory());

            await waitFor(() => {
                expect(result.current.history).toHaveLength(STORAGE.MAX_HISTORY);
            });

            act(() => {
                result.current.saveComposition(
                    createMockParams(),
                    createMockComposition(),
                    createMockAudioResults()
                );
            });

            // Should still be MAX_HISTORY, oldest one dropped
            expect(result.current.history).toHaveLength(STORAGE.MAX_HISTORY);
            expect(result.current.history[0].id).toMatch(/^comp_\d+_/);
        });

        it('persists to localStorage after save', () => {
            const { result } = renderHook(() => useCompositionHistory());

            act(() => {
                result.current.saveComposition(
                    createMockParams(),
                    createMockComposition(),
                    createMockAudioResults()
                );
            });

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                STORAGE.HISTORY_KEY,
                expect.any(String)
            );
        });

        it('returns the saved composition with id', () => {
            const { result } = renderHook(() => useCompositionHistory());
            let saved: SavedComposition | undefined;

            act(() => {
                saved = result.current.saveComposition(
                    createMockParams(),
                    createMockComposition(),
                    createMockAudioResults()
                );
            });

            expect(saved).toBeDefined();
            expect(saved?.id).toMatch(/^comp_/);
            expect(saved?.params.mode).toBe('gong');
        });
    });

    describe('deleteComposition()', () => {
        it('removes composition by id', async () => {
            const existingHistory = [
                createMockSavedComposition('comp_1'),
                createMockSavedComposition('comp_2'),
            ];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(existingHistory));

            const { result } = renderHook(() => useCompositionHistory());

            await waitFor(() => {
                expect(result.current.history).toHaveLength(2);
            });

            act(() => {
                result.current.deleteComposition('comp_1');
            });

            expect(result.current.history).toHaveLength(1);
            expect(result.current.history[0].id).toBe('comp_2');
        });

        it('does nothing if id not found', async () => {
            const existingHistory = [createMockSavedComposition('comp_1')];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(existingHistory));

            const { result } = renderHook(() => useCompositionHistory());

            await waitFor(() => {
                expect(result.current.history).toHaveLength(1);
            });

            act(() => {
                result.current.deleteComposition('nonexistent');
            });

            expect(result.current.history).toHaveLength(1);
        });

        it('persists to localStorage after delete', async () => {
            const existingHistory = [createMockSavedComposition('comp_1')];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(existingHistory));

            const { result } = renderHook(() => useCompositionHistory());

            await waitFor(() => {
                expect(result.current.history).toHaveLength(1);
            });

            vi.clearAllMocks();

            act(() => {
                result.current.deleteComposition('comp_1');
            });

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                STORAGE.HISTORY_KEY,
                expect.any(String)
            );
        });
    });

    describe('clearHistory()', () => {
        it('removes all compositions', async () => {
            const existingHistory = [
                createMockSavedComposition('comp_1'),
                createMockSavedComposition('comp_2'),
            ];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(existingHistory));

            const { result } = renderHook(() => useCompositionHistory());

            await waitFor(() => {
                expect(result.current.history).toHaveLength(2);
            });

            act(() => {
                result.current.clearHistory();
            });

            expect(result.current.history).toHaveLength(0);
        });

        it('removes key from localStorage', async () => {
            const existingHistory = [createMockSavedComposition('comp_1')];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(existingHistory));

            const { result } = renderHook(() => useCompositionHistory());

            await waitFor(() => {
                expect(result.current.history).toHaveLength(1);
            });

            act(() => {
                result.current.clearHistory();
            });

            expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE.HISTORY_KEY);
        });
    });

    describe('getComposition()', () => {
        it('returns composition by id', async () => {
            const existingHistory = [
                createMockSavedComposition('comp_1'),
                createMockSavedComposition('comp_2'),
            ];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(existingHistory));

            const { result } = renderHook(() => useCompositionHistory());

            await waitFor(() => {
                expect(result.current.history).toHaveLength(2);
            });

            const found = result.current.getComposition('comp_2');
            expect(found?.id).toBe('comp_2');
        });

        it('returns undefined if id not found', async () => {
            const existingHistory = [createMockSavedComposition('comp_1')];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(existingHistory));

            const { result } = renderHook(() => useCompositionHistory());

            await waitFor(() => {
                expect(result.current.history).toHaveLength(1);
            });

            const found = result.current.getComposition('nonexistent');
            expect(found).toBeUndefined();
        });
    });

    describe('QuotaExceededError Handling', () => {
        it('trims to FALLBACK_HISTORY on first quota error', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const { result } = renderHook(() => useCompositionHistory());

            // First setItem fails with quota error
            const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
            localStorageMock.setItem
                .mockImplementationOnce(() => { throw quotaError; })
                .mockImplementationOnce(() => {}); // Second call succeeds

            act(() => {
                result.current.saveComposition(
                    createMockParams(),
                    createMockComposition(),
                    createMockAudioResults()
                );
            });

            // Should have tried to save trimmed history
            expect(localStorageMock.setItem).toHaveBeenCalledTimes(2);
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('clears all on second quota error', () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            const { result } = renderHook(() => useCompositionHistory());

            // Both setItem calls fail with quota error
            const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
            localStorageMock.setItem.mockImplementation(() => { throw quotaError; });

            act(() => {
                result.current.saveComposition(
                    createMockParams(),
                    createMockComposition(),
                    createMockAudioResults()
                );
            });

            // Should have removed the key entirely
            expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE.HISTORY_KEY);
        });

        it('updates state to cleared history on fallback failure', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});

            // Start with existing history that will be trimmed
            const existingHistory = Array.from({ length: 8 }, (_, i) =>
                createMockSavedComposition(`comp_${i}`)
            );
            localStorageMock.getItem.mockReturnValue(JSON.stringify(existingHistory));

            const { result } = renderHook(() => useCompositionHistory());

            await waitFor(() => {
                expect(result.current.history).toHaveLength(8);
            });

            // Both setItem calls fail with quota error
            const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
            localStorageMock.setItem.mockImplementation(() => { throw quotaError; });

            act(() => {
                result.current.saveComposition(
                    createMockParams(),
                    createMockComposition(),
                    createMockAudioResults()
                );
            });

            // After double quota failure, history should be cleared
            await waitFor(() => {
                expect(result.current.history).toEqual([]);
            });
        });
    });

    describe('persistHistory Error Handling', () => {
        it('logs error on general setItem failure', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            localStorageMock.setItem.mockImplementation(() => {
                throw new Error('Storage disabled');
            });

            const { result } = renderHook(() => useCompositionHistory());

            act(() => {
                result.current.saveComposition(
                    createMockParams(),
                    createMockComposition(),
                    createMockAudioResults()
                );
            });

            expect(consoleSpy).toHaveBeenCalled();
        });

        it('does not crash when localStorage.setItem throws', () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            localStorageMock.setItem.mockImplementation(() => {
                throw new Error('Storage disabled');
            });

            const { result } = renderHook(() => useCompositionHistory());

            // Should not throw
            expect(() => {
                act(() => {
                    result.current.saveComposition(
                        createMockParams(),
                        createMockComposition(),
                        createMockAudioResults()
                    );
                });
            }).not.toThrow();

            // State should still be updated even if persistence failed
            expect(result.current.history).toHaveLength(1);
        });
    });
});
