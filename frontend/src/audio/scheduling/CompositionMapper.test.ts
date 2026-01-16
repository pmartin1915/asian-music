/**
 * Unit tests for CompositionMapper.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapCompositionToTracks, getCompositionDuration, buildScale } from './CompositionMapper';
import type { Composition, CompositionParams, Motif, Instrument } from '../../types/music';
import { SECTION_DURATION } from '../types';
import * as EuclideanRhythm from './EuclideanRhythm';
import * as MoodParams from '../utils/moodParams';

// Mock dependencies to control timing and randomness
vi.mock('./EuclideanRhythm', async (importOriginal) => {
    const actual = await importOriginal<typeof EuclideanRhythm>();
    return {
        ...actual,
        numericToBoolean: vi.fn((pattern) => pattern.map((n: number) => n !== 0)),
        repeatPatternTimes: vi.fn(() => [0, 2, 4]),
        generateEuclidean: vi.fn(() => [1, 0, 1, 0]),
    };
});

vi.mock('../utils/moodParams', async (importOriginal) => {
    const actual = await importOriginal<typeof MoodParams>();
    return {
        ...actual,
        rhythmToDuration: vi.fn((val: number, _tempo: number) => val * 0.5),
    };
});

describe('CompositionMapper', () => {
    let mockComposition: Composition;
    let mockParams: CompositionParams;

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset mock return values
        vi.mocked(EuclideanRhythm.repeatPatternTimes).mockReturnValue([0, 2, 4]);

        const mockMotif: Motif = {
            pitches: ['C4', 'D4', 'E4'],
            rhythm: [1, 1, 2],
        };

        mockComposition = {
            scale: ['C4', 'D4', 'E4', 'G4', 'A4'],
            motif: mockMotif,
            form: ['A', 'B'],
            instrumentRoles: {
                erhu: 'melody',
                guzheng: 'accompaniment',
            },
            euclideanPatterns: {
                erhu: [1, 0, 1, 0],
                accompaniment: [1, 1, 1, 1],
            },
        };

        mockParams = {
            mode: 'gong',
            root: 'C',
            tempo: 120,
            instruments: ['erhu', 'guzheng'] as Instrument[],
            mood: 'calm',
        };
    });

    describe('buildScale', () => {
        it('builds a Gong (Major) pentatonic scale correctly', () => {
            const scale = buildScale('C', 'gong', 4);
            expect(scale).toEqual(['C4', 'D4', 'E4', 'G4', 'A4']);
        });

        it('builds a Shang pentatonic scale correctly', () => {
            const scale = buildScale('C', 'shang', 4);
            expect(scale).toEqual(['C4', 'D4', 'F4', 'G4', 'A#4']);
        });

        it('builds a Jue pentatonic scale correctly', () => {
            const scale = buildScale('C', 'jue', 4);
            expect(scale).toEqual(['C4', 'D#4', 'F4', 'G#4', 'A#4']);
        });

        it('builds a Zhi pentatonic scale correctly', () => {
            const scale = buildScale('C', 'zhi', 4);
            expect(scale).toEqual(['C4', 'D4', 'F4', 'G4', 'A4']);
        });

        it('builds a Yu (Minor) pentatonic scale correctly', () => {
            const scale = buildScale('C', 'yu', 4);
            expect(scale).toEqual(['C4', 'D#4', 'F4', 'G4', 'A#4']);
        });

        it('handles different root notes', () => {
            const scale = buildScale('D', 'gong', 4);
            expect(scale).toEqual(['D4', 'E4', 'F#4', 'A4', 'B4']);
        });

        it('handles different octaves', () => {
            const scale = buildScale('C', 'gong', 5);
            expect(scale).toEqual(['C5', 'D5', 'E5', 'G5', 'A5']);
        });

        it('handles sharp root notes', () => {
            const scale = buildScale('F#', 'gong', 4);
            expect(scale[0]).toBe('F#4');
            expect(scale.length).toBe(5);
        });

        it('returns 5 notes for all modes', () => {
            const modes: ('gong' | 'shang' | 'jue' | 'zhi' | 'yu')[] = ['gong', 'shang', 'jue', 'zhi', 'yu'];
            modes.forEach(mode => {
                const scale = buildScale('C', mode, 4);
                expect(scale.length).toBe(5);
            });
        });
    });

    describe('getCompositionDuration', () => {
        it('calculates duration based on form length', () => {
            const composition = { ...mockComposition, form: ['A', 'A', 'B'] };
            const duration = getCompositionDuration(composition);
            expect(duration).toBe(3 * SECTION_DURATION);
        });

        it('returns correct duration for single section', () => {
            const composition = { ...mockComposition, form: ['A'] };
            expect(getCompositionDuration(composition)).toBe(SECTION_DURATION);
        });

        it('returns 0 for empty form', () => {
            const composition = { ...mockComposition, form: [] };
            expect(getCompositionDuration(composition)).toBe(0);
        });

        it('handles form with variations', () => {
            const composition = { ...mockComposition, form: ['A', 'B', "A'", "A''"] };
            expect(getCompositionDuration(composition)).toBe(4 * SECTION_DURATION);
        });
    });

    describe('mapCompositionToTracks', () => {
        it('returns a Map containing all requested instruments', () => {
            const tracks = mapCompositionToTracks(mockComposition, mockParams);
            expect(tracks.size).toBe(2);
            expect(tracks.has('erhu')).toBe(true);
            expect(tracks.has('guzheng')).toBe(true);
        });

        it('does not include instruments not in params', () => {
            const tracks = mapCompositionToTracks(mockComposition, mockParams);
            expect(tracks.has('pipa')).toBe(false);
            expect(tracks.has('dizi')).toBe(false);
        });

        it('assigns correct roles to tracks', () => {
            const tracks = mapCompositionToTracks(mockComposition, mockParams);
            expect(tracks.get('erhu')?.role).toBe('melody');
            expect(tracks.get('guzheng')?.role).toBe('accompaniment');
        });

        it('defaults role to accompaniment if missing in composition', () => {
            const params = { ...mockParams, instruments: ['pipa'] as Instrument[] };
            const comp = { ...mockComposition, instrumentRoles: {} };

            const tracks = mapCompositionToTracks(comp, params);
            expect(tracks.get('pipa')?.role).toBe('accompaniment');
        });

        it('uses instrument-specific euclidean pattern if available', () => {
            const erhuPattern = [1, 1, 0, 0];
            const comp = {
                ...mockComposition,
                euclideanPatterns: { erhu: erhuPattern },
            };

            mapCompositionToTracks(comp, mockParams);
            expect(EuclideanRhythm.numericToBoolean).toHaveBeenCalledWith(erhuPattern);
        });

        it('falls back to role-based pattern if instrument pattern missing', () => {
            const melodyPattern = [1, 0, 1, 0];
            const comp = {
                ...mockComposition,
                instrumentRoles: { erhu: 'melody' },
                euclideanPatterns: { melody: melodyPattern },
            };

            mapCompositionToTracks(comp, mockParams);
            expect(EuclideanRhythm.numericToBoolean).toHaveBeenCalledWith(melodyPattern);
        });

        it('generates a fallback pattern if both missing', () => {
            const comp = { ...mockComposition, euclideanPatterns: {} };
            mapCompositionToTracks(comp, mockParams);
            expect(EuclideanRhythm.generateEuclidean).toHaveBeenCalledWith(5, 8);
        });

        it('generates notes for each track', () => {
            const tracks = mapCompositionToTracks(mockComposition, mockParams);

            tracks.forEach((track, instrument) => {
                expect(track.notes).toBeDefined();
                expect(Array.isArray(track.notes)).toBe(true);
                expect(track.instrument).toBe(instrument);
            });
        });
    });

    describe('Role-specific Note Generation', () => {
        it('generates melody notes using motif pitches', () => {
            vi.mocked(EuclideanRhythm.repeatPatternTimes).mockReturnValue([0, 1, 2]);

            const tracks = mapCompositionToTracks(mockComposition, mockParams);
            const erhuNotes = tracks.get('erhu')?.notes || [];

            expect(erhuNotes.length).toBeGreaterThan(0);
            expect(erhuNotes[0].pitch).toBe('C4');
            expect(erhuNotes[0].instrument).toBe('erhu');
        });

        it('generates bass notes at lower octave', () => {
            vi.mocked(EuclideanRhythm.repeatPatternTimes).mockReturnValue([0, 2]);
            const params = { ...mockParams, instruments: ['erhu'] as Instrument[] };
            const comp = {
                ...mockComposition,
                instrumentRoles: { erhu: 'bass' },
            };

            const tracks = mapCompositionToTracks(comp, params);
            const notes = tracks.get('erhu')?.notes || [];

            expect(notes.length).toBeGreaterThan(0);
            // Bass transposes down (octaveOffset -1 from ROLE_OCTAVE_OFFSET, then -1 more in bass logic)
            expect(notes[0].pitch).toContain('3'); // Lower octave
        });

        it('generates accompaniment notes with arpeggio pattern', () => {
            vi.mocked(EuclideanRhythm.repeatPatternTimes).mockReturnValue([0, 1, 2, 3]);
            const params = { ...mockParams, instruments: ['guzheng'] as Instrument[] };

            const tracks = mapCompositionToTracks(mockComposition, params);
            const notes = tracks.get('guzheng')?.notes || [];

            expect(notes.length).toBeGreaterThan(0);
            // Chord pattern: 0, 2, 4, 2 -> C4, E4, A4, E4
            expect(notes[0].pitch).toBe('C4');
        });

        it('generates countermelody notes starting from third degree', () => {
            vi.mocked(EuclideanRhythm.repeatPatternTimes).mockReturnValue([0, 1, 2]);
            const params = { ...mockParams, instruments: ['dizi'] as Instrument[] };
            const comp = {
                ...mockComposition,
                instrumentRoles: { dizi: 'countermelody' },
            };

            const tracks = mapCompositionToTracks(comp, params);
            const notes = tracks.get('dizi')?.notes || [];

            expect(notes.length).toBeGreaterThan(0);
            // Countermelody starts at scale index 2 (E4)
            expect(notes[0].pitch).toBe('E4');
        });

        it('notes have valid frequency values', () => {
            const tracks = mapCompositionToTracks(mockComposition, mockParams);

            tracks.forEach(track => {
                track.notes.forEach(note => {
                    expect(note.frequency).toBeGreaterThan(0);
                });
            });
        });

        it('notes have valid duration values', () => {
            const tracks = mapCompositionToTracks(mockComposition, mockParams);

            tracks.forEach(track => {
                track.notes.forEach(note => {
                    expect(note.duration).toBeGreaterThan(0);
                });
            });
        });

        it('notes have valid velocity values', () => {
            const tracks = mapCompositionToTracks(mockComposition, mockParams);

            tracks.forEach(track => {
                track.notes.forEach(note => {
                    expect(note.velocity).toBeGreaterThan(0);
                    expect(note.velocity).toBeLessThanOrEqual(1.5); // Allow some boost
                });
            });
        });
    });

    describe('Section Variations', () => {
        it('modifies velocity in section B', () => {
            vi.mocked(EuclideanRhythm.repeatPatternTimes).mockReturnValue([0, SECTION_DURATION + 1]);

            const tracks = mapCompositionToTracks(mockComposition, mockParams);
            const notes = tracks.get('erhu')?.notes || [];

            const noteSectionA = notes[0];
            const noteSectionB = notes[1];

            // Section B should have higher velocity than A
            expect(noteSectionB.velocity).toBeGreaterThan(noteSectionA.velocity);
        });

        it('handles B section motif variation', () => {
            vi.mocked(EuclideanRhythm.repeatPatternTimes).mockReturnValue([0, SECTION_DURATION + 1]);

            const tracks = mapCompositionToTracks(mockComposition, mockParams);
            const notes = tracks.get('erhu')?.notes || [];

            expect(notes.length).toBe(2);
            // Section B starts mid-motif for contrast
            expect(notes[1].pitch).toBeDefined();
        });
    });

    describe('Edge Cases', () => {
        it('handles single note scale', () => {
            const singleScaleComp = { ...mockComposition, scale: ['C4'] };
            const tracks = mapCompositionToTracks(singleScaleComp, mockParams);
            const notes = tracks.get('erhu')?.notes || [];

            expect(notes[0].pitch).toBe('C4');
        });

        it('handles empty hit times', () => {
            vi.mocked(EuclideanRhythm.repeatPatternTimes).mockReturnValue([]);

            const tracks = mapCompositionToTracks(mockComposition, mockParams);
            const notes = tracks.get('erhu')?.notes || [];

            expect(notes.length).toBe(0);
        });

        it('handles single instrument', () => {
            const params = { ...mockParams, instruments: ['erhu'] as Instrument[] };
            const tracks = mapCompositionToTracks(mockComposition, params);

            expect(tracks.size).toBe(1);
            expect(tracks.has('erhu')).toBe(true);
        });

        it('handles all four instruments', () => {
            const params = {
                ...mockParams,
                instruments: ['erhu', 'guzheng', 'pipa', 'dizi'] as Instrument[]
            };
            const comp = {
                ...mockComposition,
                instrumentRoles: {
                    erhu: 'melody',
                    guzheng: 'accompaniment',
                    pipa: 'bass',
                    dizi: 'countermelody',
                },
            };

            const tracks = mapCompositionToTracks(comp, params);
            expect(tracks.size).toBe(4);
        });
    });
});
