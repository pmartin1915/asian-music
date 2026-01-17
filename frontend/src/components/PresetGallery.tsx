import React, { useState, useCallback } from 'react';
import { PRESETS, type CompositionPreset } from '../data/presets';

interface PresetGalleryProps {
    onSelect: (preset: CompositionPreset) => void;
    isGenerating: boolean;
}

const MODE_COLORS: Record<string, string> = {
    gong: 'bg-amber-500',
    shang: 'bg-red-500',
    jue: 'bg-green-500',
    zhi: 'bg-orange-500',
    yu: 'bg-purple-500',
};

const MODE_LABELS: Record<string, string> = {
    gong: 'G',
    shang: 'S',
    jue: 'J',
    zhi: 'Z',
    yu: 'Y',
};

export const PresetGallery: React.FC<PresetGalleryProps> = ({
    onSelect,
    isGenerating,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const handleSelect = useCallback((preset: CompositionPreset) => {
        if (!isGenerating) {
            onSelect(preset);
        }
    }, [isGenerating, onSelect]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent, preset: CompositionPreset) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelect(preset);
        }
    }, [handleSelect]);

    return (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-lg shadow-sm border border-amber-200">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full text-left"
                aria-expanded={isExpanded}
                aria-controls="preset-list"
            >
                <h3 className="font-bold text-amber-800 text-sm flex items-center gap-2">
                    <span>Demo Compositions</span>
                    <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                        {PRESETS.length}
                    </span>
                </h3>
                <span className="text-amber-600 text-lg" aria-hidden="true">
                    {isExpanded ? '−' : '+'}
                </span>
            </button>

            {isExpanded && (
                <div
                    id="preset-list"
                    className="mt-3 space-y-2"
                    role="listbox"
                    aria-label="Demo compositions"
                >
                    {PRESETS.map((preset) => (
                        <div
                            key={preset.id}
                            role="option"
                            tabIndex={isGenerating ? -1 : 0}
                            aria-selected={false}
                            aria-disabled={isGenerating}
                            className={`
                                group flex items-center gap-3 p-3 rounded-lg
                                bg-white/80 border border-amber-100
                                transition-all duration-150
                                ${isGenerating
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:bg-white hover:border-amber-300 hover:shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400'
                                }
                            `}
                            onClick={() => handleSelect(preset)}
                            onKeyDown={(e) => handleKeyDown(e, preset)}
                        >
                            {/* Mode Badge */}
                            <span
                                className={`
                                    w-8 h-8 rounded-lg text-white text-sm font-bold
                                    flex items-center justify-center flex-shrink-0
                                    ${MODE_COLORS[preset.params.mode] || 'bg-gray-500'}
                                `}
                                title={`${preset.params.mode} mode`}
                            >
                                {MODE_LABELS[preset.params.mode] || '?'}
                            </span>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-800 truncate">
                                    {preset.name}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                    {preset.description}
                                </div>
                            </div>

                            {/* Instruments */}
                            <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                                {preset.params.instruments.map((instrument) => (
                                    <span
                                        key={instrument}
                                        className="text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded"
                                        title={instrument}
                                    >
                                        {instrument.slice(0, 2)}
                                    </span>
                                ))}
                            </div>

                            {/* Play indicator */}
                            <span
                                className={`
                                    text-amber-500 opacity-0 transition-opacity
                                    ${!isGenerating && 'group-hover:opacity-100 group-focus:opacity-100'}
                                `}
                                aria-hidden="true"
                            >
                                ▶
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {isExpanded && (
                <p className="mt-3 text-xs text-amber-700/70 text-center">
                    Click a preset to generate and play
                </p>
            )}
        </div>
    );
};
