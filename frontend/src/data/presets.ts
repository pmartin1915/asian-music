/**
 * Pre-built composition presets for demonstration and quick start.
 * Each preset includes a curated composition structure that can be
 * immediately synthesized into audio.
 */

import type { CompositionParams, Composition, PentatonicMode, Instrument, Mood } from '../types/music';

export interface CompositionPreset {
    id: string;
    name: string;
    description: string;
    params: CompositionParams;
    composition: Composition;
}

/**
 * 5 curated presets showcasing different modes, moods, and instrument combinations.
 */
export const PRESETS: CompositionPreset[] = [
    {
        id: 'preset_mountain_dawn',
        name: 'Mountain Dawn',
        description: 'Peaceful morning meditation with erhu and guzheng',
        params: {
            mode: 'gong' as PentatonicMode,
            root: 'D',
            tempo: 66,
            instruments: ['erhu', 'guzheng'] as Instrument[],
            mood: 'calm' as Mood,
            seed: 42,
        },
        composition: {
            scale: ['D4', 'E4', 'F#4', 'A4', 'B4'],
            motif: {
                pitches: ['D4', 'F#4', 'A4', 'E4', 'D4', 'B3', 'A3'],
                rhythm: [1, 0.5, 0.75, 0.5, 1.25, 0.5, 1],
            },
            form: ['A', "A'", 'B', "A''"],
            instrumentRoles: {
                erhu: 'melody',
                guzheng: 'accompaniment',
            },
            euclideanPatterns: {
                melody: [1, 0, 1, 0, 1, 1, 0, 1],
                accompaniment: [1, 0, 0, 1, 0, 1, 0, 0],
            },
        },
    },
    {
        id: 'preset_festival_dance',
        name: 'Festival Dance',
        description: 'Lively celebration with pipa, dizi, and erhu',
        params: {
            mode: 'zhi' as PentatonicMode,
            root: 'G',
            tempo: 120,
            instruments: ['pipa', 'dizi', 'erhu'] as Instrument[],
            mood: 'festive' as Mood,
            seed: 888,
        },
        composition: {
            scale: ['G4', 'A4', 'B4', 'D5', 'E5'],
            motif: {
                pitches: ['G4', 'B4', 'D5', 'E5', 'D5', 'B4', 'A4', 'G4'],
                rhythm: [0.5, 0.5, 0.5, 0.25, 0.25, 0.5, 0.5, 1],
            },
            form: ['A', 'B', "A'", 'B', "A''"],
            instrumentRoles: {
                pipa: 'melody',
                dizi: 'melody',
                erhu: 'accompaniment',
            },
            euclideanPatterns: {
                melody: [1, 1, 0, 1, 1, 0, 1, 0],
                accompaniment: [1, 0, 1, 0, 1, 0, 1, 0],
            },
        },
    },
    {
        id: 'preset_autumn_reflection',
        name: 'Autumn Reflection',
        description: 'Contemplative piece in minor pentatonic',
        params: {
            mode: 'yu' as PentatonicMode,
            root: 'A',
            tempo: 54,
            instruments: ['erhu', 'guzheng'] as Instrument[],
            mood: 'melancholic' as Mood,
            seed: 1024,
        },
        composition: {
            scale: ['A3', 'C4', 'D4', 'E4', 'G4'],
            motif: {
                pitches: ['A3', 'C4', 'E4', 'D4', 'C4', 'A3'],
                rhythm: [1.5, 0.75, 0.75, 1, 0.5, 1.5],
            },
            form: ['A', "A'", 'B', "A''"],
            instrumentRoles: {
                erhu: 'melody',
                guzheng: 'accompaniment',
            },
            euclideanPatterns: {
                melody: [1, 0, 0, 1, 0, 1, 0, 0],
                accompaniment: [1, 0, 0, 0, 1, 0, 0, 1],
            },
        },
    },
    {
        id: 'preset_dragons_march',
        name: "Dragon's March",
        description: 'Bold and heroic full ensemble piece',
        params: {
            mode: 'shang' as PentatonicMode,
            root: 'E',
            tempo: 96,
            instruments: ['erhu', 'guzheng', 'pipa', 'dizi'] as Instrument[],
            mood: 'heroic' as Mood,
            seed: 2048,
        },
        composition: {
            scale: ['E4', 'F#4', 'A4', 'B4', 'D5'],
            motif: {
                pitches: ['E4', 'A4', 'B4', 'D5', 'B4', 'A4', 'F#4', 'E4'],
                rhythm: [0.75, 0.75, 0.5, 1, 0.5, 0.5, 0.5, 1],
            },
            form: ['A', 'B', "A'", 'B', "A''"],
            instrumentRoles: {
                erhu: 'melody',
                dizi: 'melody',
                guzheng: 'accompaniment',
                pipa: 'bass',
            },
            euclideanPatterns: {
                melody: [1, 0, 1, 1, 0, 1, 1, 0],
                accompaniment: [1, 0, 1, 0, 1, 0, 1, 0],
                bass: [1, 0, 0, 1, 0, 0, 1, 0],
            },
        },
    },
    {
        id: 'preset_bamboo_grove',
        name: 'Bamboo Grove',
        description: 'Pastoral flute melody with plucked accompaniment',
        params: {
            mode: 'jue' as PentatonicMode,
            root: 'C',
            tempo: 72,
            instruments: ['dizi', 'pipa'] as Instrument[],
            mood: 'calm' as Mood,
            seed: 512,
        },
        composition: {
            scale: ['C4', 'D4', 'F4', 'G4', 'A4'],
            motif: {
                pitches: ['C4', 'F4', 'G4', 'A4', 'G4', 'F4', 'D4'],
                rhythm: [1, 0.5, 0.5, 1, 0.5, 0.5, 1],
            },
            form: ['A', "A'", 'B', "A''"],
            instrumentRoles: {
                dizi: 'melody',
                pipa: 'accompaniment',
            },
            euclideanPatterns: {
                melody: [1, 0, 1, 0, 1, 0, 1, 0],
                accompaniment: [1, 0, 0, 1, 0, 0, 1, 0],
            },
        },
    },
];

/**
 * Get a preset by its ID.
 */
export function getPresetById(id: string): CompositionPreset | undefined {
    return PRESETS.find(preset => preset.id === id);
}

/**
 * Get presets filtered by mode.
 */
export function getPresetsByMode(mode: PentatonicMode): CompositionPreset[] {
    return PRESETS.filter(preset => preset.params.mode === mode);
}

/**
 * Get presets filtered by mood.
 */
export function getPresetsByMood(mood: Mood): CompositionPreset[] {
    return PRESETS.filter(preset => preset.params.mood === mood);
}
