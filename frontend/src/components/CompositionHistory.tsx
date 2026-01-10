import React from 'react';
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

    const getModeEmoji = (mode: string): string => {
        const modeEmojis: Record<string, string> = {
            gong: '🏛️',
            shang: '📯',
            jue: '🌿',
            zhi: '🔥',
            yu: '🪶',
        };
        return modeEmojis[mode] || '🎵';
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

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {history.map((item) => (
                    <div
                        key={item.id}
                        className="group flex items-center gap-2 p-2 rounded-lg hover:bg-stone-50 cursor-pointer transition-colors"
                        onClick={() => onSelect(item)}
                    >
                        <span className="text-lg">{getModeEmoji(item.params.mode)}</span>

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
                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-silk-red transition-all p-1"
                                title="Delete"
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
