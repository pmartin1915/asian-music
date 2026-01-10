import { useState, useCallback, useEffect } from 'react';
import type { CompositionParams, Composition, InstrumentAudioResult } from '../types/music';
import { STORAGE } from '../config/constants';
import { validateHistoryData } from '../utils/validation';

export interface SavedComposition {
    id: string;
    params: CompositionParams;
    composition: Composition;
    audioResults: InstrumentAudioResult[];
    createdAt: number;
}

const generateId = (): string => {
    return `comp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export const useCompositionHistory = () => {
    const [history, setHistory] = useState<SavedComposition[]>([]);

    // Load history from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE.HISTORY_KEY);
            if (stored) {
                const parsed = validateHistoryData(JSON.parse(stored));
                setHistory(parsed);
            }
        } catch (error) {
            console.error('Failed to load composition history:', error);
        }
    }, []);

    // Persist history to localStorage
    const persistHistory = useCallback((newHistory: SavedComposition[]) => {
        try {
            localStorage.setItem(STORAGE.HISTORY_KEY, JSON.stringify(newHistory));
        } catch (error) {
            console.error('Failed to save composition history:', error);
            // If storage is full, try removing oldest entries
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                const trimmed = newHistory.slice(-STORAGE.FALLBACK_HISTORY);
                try {
                    localStorage.setItem(STORAGE.HISTORY_KEY, JSON.stringify(trimmed));
                    setHistory(trimmed);
                } catch {
                    // If still failing, clear all
                    localStorage.removeItem(STORAGE.HISTORY_KEY);
                    setHistory([]);
                }
            }
        }
    }, []);

    const saveComposition = useCallback((
        params: CompositionParams,
        composition: Composition,
        audioResults: InstrumentAudioResult[]
    ): SavedComposition => {
        const saved: SavedComposition = {
            id: generateId(),
            params,
            composition,
            audioResults,
            createdAt: Date.now(),
        };

        setHistory((prev) => {
            // Keep only the most recent MAX_HISTORY items
            const newHistory = [saved, ...prev].slice(0, STORAGE.MAX_HISTORY);
            persistHistory(newHistory);
            return newHistory;
        });

        return saved;
    }, [persistHistory]);

    const deleteComposition = useCallback((id: string) => {
        setHistory((prev) => {
            const newHistory = prev.filter((item) => item.id !== id);
            persistHistory(newHistory);
            return newHistory;
        });
    }, [persistHistory]);

    const clearHistory = useCallback(() => {
        setHistory([]);
        localStorage.removeItem(STORAGE.HISTORY_KEY);
    }, []);

    const getComposition = useCallback((id: string): SavedComposition | undefined => {
        return history.find((item) => item.id === id);
    }, [history]);

    return {
        history,
        saveComposition,
        deleteComposition,
        clearHistory,
        getComposition,
    };
};
