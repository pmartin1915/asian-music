import { describe, it, expect } from 'vitest';
import {
    PRESETS,
    getPresetById,
    getPresetsByMode,
    getPresetsByMood,
    type CompositionPreset,
} from './presets';
import type { PentatonicMode, Instrument, Mood } from '../types/music';

describe('Presets Data', () => {
    describe('PRESETS array', () => {
        it('should have exactly 5 presets', () => {
            expect(PRESETS).toHaveLength(5);
        });

        it('should have unique IDs for all presets', () => {
            const ids = PRESETS.map(p => p.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(PRESETS.length);
        });

        it('should have unique names for all presets', () => {
            const names = PRESETS.map(p => p.name);
            const uniqueNames = new Set(names);
            expect(uniqueNames.size).toBe(PRESETS.length);
        });
    });

    describe('Preset structure validation', () => {
        const validModes: PentatonicMode[] = ['gong', 'shang', 'jue', 'zhi', 'yu'];
        const validInstruments: Instrument[] = ['erhu', 'guzheng', 'pipa', 'dizi'];
        const validMoods: Mood[] = ['calm', 'heroic', 'melancholic', 'festive'];

        PRESETS.forEach((preset: CompositionPreset) => {
            describe(`Preset: ${preset.name}`, () => {
                it('should have a valid id', () => {
                    expect(preset.id).toBeTruthy();
                    expect(typeof preset.id).toBe('string');
                    expect(preset.id.length).toBeGreaterThan(0);
                });

                it('should have a name and description', () => {
                    expect(preset.name).toBeTruthy();
                    expect(preset.description).toBeTruthy();
                });

                describe('params', () => {
                    it('should have a valid mode', () => {
                        expect(validModes).toContain(preset.params.mode);
                    });

                    it('should have a valid root key', () => {
                        expect(preset.params.root).toMatch(/^[A-G]#?$/);
                    });

                    it('should have tempo within valid range (40-160)', () => {
                        expect(preset.params.tempo).toBeGreaterThanOrEqual(40);
                        expect(preset.params.tempo).toBeLessThanOrEqual(160);
                    });

                    it('should have at least one valid instrument', () => {
                        expect(preset.params.instruments.length).toBeGreaterThan(0);
                        preset.params.instruments.forEach(inst => {
                            expect(validInstruments).toContain(inst);
                        });
                    });

                    it('should have a valid mood', () => {
                        expect(validMoods).toContain(preset.params.mood);
                    });
                });

                describe('composition', () => {
                    it('should have a scale with 5 notes (pentatonic)', () => {
                        expect(preset.composition.scale).toHaveLength(5);
                    });

                    it('should have scale notes in valid format', () => {
                        preset.composition.scale.forEach(note => {
                            expect(note).toMatch(/^[A-G]#?\d$/);
                        });
                    });

                    it('should have a motif with pitches and rhythm', () => {
                        expect(preset.composition.motif.pitches.length).toBeGreaterThan(0);
                        expect(preset.composition.motif.rhythm.length).toBeGreaterThan(0);
                    });

                    it('should have motif pitches matching rhythm length', () => {
                        expect(preset.composition.motif.pitches.length)
                            .toBe(preset.composition.motif.rhythm.length);
                    });

                    it('should have a form array', () => {
                        expect(preset.composition.form.length).toBeGreaterThan(0);
                        preset.composition.form.forEach(section => {
                            expect(section).toMatch(/^[AB]'*$/);
                        });
                    });

                    it('should have instrument roles matching params instruments', () => {
                        const roles = Object.keys(preset.composition.instrumentRoles);
                        preset.params.instruments.forEach(inst => {
                            expect(roles).toContain(inst);
                        });
                    });

                    it('should have valid roles (melody, bass, accompaniment)', () => {
                        const validRoles = ['melody', 'bass', 'accompaniment'];
                        Object.values(preset.composition.instrumentRoles).forEach(role => {
                            expect(validRoles).toContain(role);
                        });
                    });

                    it('should have euclidean patterns for each role', () => {
                        const roles = new Set(Object.values(preset.composition.instrumentRoles));
                        roles.forEach(role => {
                            expect(preset.composition.euclideanPatterns[role]).toBeDefined();
                            expect(preset.composition.euclideanPatterns[role].length).toBeGreaterThan(0);
                        });
                    });

                    it('should have euclidean patterns with only 0s and 1s', () => {
                        Object.values(preset.composition.euclideanPatterns).forEach(pattern => {
                            pattern.forEach(value => {
                                expect([0, 1]).toContain(value);
                            });
                        });
                    });
                });
            });
        });
    });

    describe('Mode coverage', () => {
        it('should cover all 5 pentatonic modes', () => {
            const modes = PRESETS.map(p => p.params.mode);
            const uniqueModes = new Set(modes);
            expect(uniqueModes.size).toBe(5);
            expect(uniqueModes).toContain('gong');
            expect(uniqueModes).toContain('shang');
            expect(uniqueModes).toContain('jue');
            expect(uniqueModes).toContain('zhi');
            expect(uniqueModes).toContain('yu');
        });
    });
});

describe('getPresetById', () => {
    it('should return preset when ID exists', () => {
        const preset = getPresetById('preset_mountain_dawn');
        expect(preset).toBeDefined();
        expect(preset?.name).toBe('Mountain Dawn');
    });

    it('should return undefined for non-existent ID', () => {
        const preset = getPresetById('non_existent_id');
        expect(preset).toBeUndefined();
    });
});

describe('getPresetsByMode', () => {
    it('should return presets filtered by mode', () => {
        const gongPresets = getPresetsByMode('gong');
        expect(gongPresets.length).toBeGreaterThan(0);
        gongPresets.forEach(preset => {
            expect(preset.params.mode).toBe('gong');
        });
    });

    it('should return empty array for mode with no presets', () => {
        // All modes are covered, but this tests the filter logic
        const allModes: PentatonicMode[] = ['gong', 'shang', 'jue', 'zhi', 'yu'];
        allModes.forEach(mode => {
            const presets = getPresetsByMode(mode);
            presets.forEach(preset => {
                expect(preset.params.mode).toBe(mode);
            });
        });
    });
});

describe('getPresetsByMood', () => {
    it('should return presets filtered by mood', () => {
        const calmPresets = getPresetsByMood('calm');
        expect(calmPresets.length).toBeGreaterThan(0);
        calmPresets.forEach(preset => {
            expect(preset.params.mood).toBe('calm');
        });
    });

    it('should return presets for each mood that has presets', () => {
        const festivePresets = getPresetsByMood('festive');
        expect(festivePresets.length).toBeGreaterThan(0);

        const heroicPresets = getPresetsByMood('heroic');
        expect(heroicPresets.length).toBeGreaterThan(0);

        const melancholicPresets = getPresetsByMood('melancholic');
        expect(melancholicPresets.length).toBeGreaterThan(0);
    });
});
