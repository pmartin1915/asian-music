import React, { useState, useCallback, useRef } from 'react';
import type { SavedComposition } from '../hooks/useCompositionHistory';

interface CompositionHistoryProps {
    history: SavedComposition[];
    onSelect: (composition: SavedComposition) => void;
    onDelete: (id: string) => void;
    onClear: () => void;
}

export const CompositionHistory: React.FC<CompositionHistoryProps> = ({
    history,
    onSelect,
    onDelete,
    onClear,
}) => {
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);
    const listRef = useRef<HTMLDivElement>(null);

    const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number, item: SavedComposition) => {
        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault();
                onSelect(item);
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (index < history.length - 1) {
                    setFocusedIndex(index + 1);
                    const nextItem = listRef.current?.querySelector(`[data-index="${index + 1}"]`) as HTMLElement;
                    nextItem?.focus();
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (index > 0) {
                    setFocusedIndex(index - 1);
                    const prevItem = listRef.current?.querySelector(`[data-index="${index - 1}"]`) as HTMLElement;
                    prevItem?.focus();
                }
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                onDelete(item.id);
                break;
            case 'Home':
                e.preventDefault();
                setFocusedIndex(0);
                const firstItem = listRef.current?.querySelector('[data-index="0"]') as HTMLElement;
                firstItem?.focus();
                break;
            case 'End':
                e.preventDefault();
                const lastIndex = history.length - 1;
                setFocusedIndex(lastIndex);
                const lastItem = listRef.current?.querySelector(`[data-index="${lastIndex}"]`) as HTMLElement;
                lastItem?.focus();
                break;
        }
    }, [history.length, onSelect, onDelete]);

    if (history.length === 0) {
        return null;
    }

    const formatDate = (timestamp: number): string => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - timestamp;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const getModeLabel = (mode: string): string => {
        const modeLabels: Record<string, string> = {
            gong: 'G',
            shang: 'S',
            jue: 'J',
            zhi: 'Z',
            yu: 'Y',
        };
        return modeLabels[mode] || '?';
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 text-sm">Recent Compositions</h3>
                <button
                    onClick={onClear}
                    className="text-xs text-gray-400 hover:text-silk-red transition-colors"
                    title="Clear history"
                >
                    Clear All
                </button>
            </div>

            <div
                ref={listRef}
                className="space-y-2 max-h-[300px] overflow-y-auto"
                role="listbox"
                aria-label="Recent compositions"
            >
                {history.map((item, index) => (
                    <div
                        key={item.id}
                        data-index={index}
                        role="option"
                        tabIndex={0}
                        aria-selected={focusedIndex === index}
                        className="group flex items-center gap-2 p-2 rounded-lg hover:bg-stone-50 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-silk-amber focus:bg-stone-50"
                        onClick={() => onSelect(item)}
                        onKeyDown={(e) => handleKeyDown(e, index, item)}
                        onFocus={() => setFocusedIndex(index)}
                    >
                        <span className="w-6 h-6 rounded bg-silk-amber text-white text-xs font-bold flex items-center justify-center">
                            {getModeLabel(item.params.mode)}
                        </span>

                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">
                                {item.params.mode.charAt(0).toUpperCase() + item.params.mode.slice(1)} Mode
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                                {item.audioResults.map((a) => a.instrument).join(', ')}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{formatDate(item.createdAt)}</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(item.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-silk-red transition-all p-1"
                                title="Delete"
                                aria-label={`Delete ${item.params.mode} mode composition`}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
