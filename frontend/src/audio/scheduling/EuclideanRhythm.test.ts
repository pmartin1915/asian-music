import { describe, it, expect } from 'vitest';
import {
    generateEuclidean,
    numericToBoolean,
    rotatePattern,
    patternToTimes,
    repeatPatternTimes,
    getPresetPattern,
    getPatternDensity,
    combinePatterns,
    invertPattern,
    RHYTHM_PRESETS
} from './EuclideanRhythm';

describe('EuclideanRhythm', () => {

    describe('generateEuclidean', () => {
        describe('standard patterns (Bjorklund algorithm)', () => {
            it('should generate E(3, 8) - Tresillo pattern', () => {
                const tresillo = generateEuclidean(3, 8);
                expect(tresillo).toEqual([true, false, false, true, false, false, true, false]);
            });

            it('should generate E(5, 8) - Cinquillo pattern', () => {
                const cinquillo = generateEuclidean(5, 8);
                expect(cinquillo).toEqual([true, false, true, true, false, true, true, false]);
            });

            it('should generate E(1, 4) - Downbeat pattern', () => {
                expect(generateEuclidean(1, 4)).toEqual([true, false, false, false]);
            });

            it('should generate E(2, 5) pattern', () => {
                const result = generateEuclidean(2, 5);
                expect(result).toHaveLength(5);
                expect(result.filter(Boolean).length).toBe(2);
            });

            it('should generate E(4, 12) pattern', () => {
                const result = generateEuclidean(4, 12);
                expect(result).toHaveLength(12);
                expect(result.filter(Boolean).length).toBe(4);
            });

            it('should generate E(7, 12) - African bell pattern', () => {
                const result = generateEuclidean(7, 12);
                expect(result).toHaveLength(12);
                expect(result.filter(Boolean).length).toBe(7);
            });

            it('should generate E(4, 9) - Aksak pattern', () => {
                const result = generateEuclidean(4, 9);
                expect(result).toHaveLength(9);
                expect(result.filter(Boolean).length).toBe(4);
            });
        });

        describe('edge cases', () => {
            it('should handle pulses = steps (all true)', () => {
                expect(generateEuclidean(4, 4)).toEqual([true, true, true, true]);
            });

            it('should handle pulses > steps (all true, capped at steps)', () => {
                expect(generateEuclidean(5, 4)).toEqual([true, true, true, true]);
                expect(generateEuclidean(10, 3)).toEqual([true, true, true]);
            });

            it('should return empty array for pulses = 0', () => {
                expect(generateEuclidean(0, 8)).toEqual([]);
            });

            it('should return empty array for steps = 0', () => {
                expect(generateEuclidean(3, 0)).toEqual([]);
            });

            it('should return empty array for negative pulses', () => {
                expect(generateEuclidean(-1, 8)).toEqual([]);
            });

            it('should return empty array for negative steps', () => {
                expect(generateEuclidean(3, -1)).toEqual([]);
            });

            it('should return empty array for both zero', () => {
                expect(generateEuclidean(0, 0)).toEqual([]);
            });

            it('should handle single pulse single step', () => {
                expect(generateEuclidean(1, 1)).toEqual([true]);
            });

            it('should handle large step counts', () => {
                const result = generateEuclidean(7, 16);
                expect(result).toHaveLength(16);
                expect(result.filter(Boolean).length).toBe(7);
            });
        });
    });

    describe('numericToBoolean', () => {
        it('should convert non-zero numbers to true and zeros to false', () => {
            expect(numericToBoolean([1, 0, 127, 0, -5])).toEqual([true, false, true, false, true]);
        });

        it('should handle all zeros', () => {
            expect(numericToBoolean([0, 0, 0])).toEqual([false, false, false]);
        });

        it('should handle all non-zeros', () => {
            expect(numericToBoolean([1, 2, 3])).toEqual([true, true, true]);
        });

        it('should handle empty arrays', () => {
            expect(numericToBoolean([])).toEqual([]);
        });

        it('should handle single element', () => {
            expect(numericToBoolean([0])).toEqual([false]);
            expect(numericToBoolean([1])).toEqual([true]);
        });

        it('should handle floating point numbers', () => {
            expect(numericToBoolean([0.5, 0.0, -0.1])).toEqual([true, false, true]);
        });
    });

    describe('rotatePattern', () => {
        it('should rotate pattern left by positive amount', () => {
            const pattern = [true, false, false, true];
            expect(rotatePattern(pattern, 1)).toEqual([false, false, true, true]);
            expect(rotatePattern(pattern, 2)).toEqual([false, true, true, false]);
        });

        it('should rotate pattern right by negative amount', () => {
            const pattern = [true, false, false];
            expect(rotatePattern(pattern, -1)).toEqual([false, true, false]);
        });

        it('should handle rotation equal to pattern length (no change)', () => {
            const pattern = [true, false, true];
            expect(rotatePattern(pattern, 3)).toEqual([true, false, true]);
        });

        it('should handle rotation larger than pattern length', () => {
            const pattern = [true, false];
            expect(rotatePattern(pattern, 3)).toEqual([false, true]);
            expect(rotatePattern(pattern, 5)).toEqual([false, true]);
        });

        it('should handle rotation of 0', () => {
            const pattern = [true, false, true];
            expect(rotatePattern(pattern, 0)).toEqual([true, false, true]);
        });

        it('should handle empty patterns', () => {
            expect(rotatePattern([], 5)).toEqual([]);
        });

        it('should handle single element pattern', () => {
            expect(rotatePattern([true], 10)).toEqual([true]);
        });

        it('should work with non-boolean types (generic)', () => {
            expect(rotatePattern([1, 2, 3], 1)).toEqual([2, 3, 1]);
            expect(rotatePattern(['a', 'b', 'c'], 2)).toEqual(['c', 'a', 'b']);
        });
    });

    describe('patternToTimes', () => {
        it('should calculate correct timings at 60 BPM with 2 subdivisions', () => {
            const pattern = [true, false, true, false];
            const times = patternToTimes(pattern, 60, 2, 0);

            expect(times).toHaveLength(2);
            expect(times[0]).toBeCloseTo(0);
            expect(times[1]).toBeCloseTo(1.0);
        });

        it('should calculate correct timings at 120 BPM', () => {
            const pattern = [true, true, true, true];
            const times = patternToTimes(pattern, 120, 2, 0);

            expect(times).toHaveLength(4);
            expect(times[0]).toBeCloseTo(0);
            expect(times[1]).toBeCloseTo(0.25);
            expect(times[2]).toBeCloseTo(0.5);
            expect(times[3]).toBeCloseTo(0.75);
        });

        it('should apply startTime offset', () => {
            const pattern = [true];
            const times = patternToTimes(pattern, 120, 1, 5.0);
            expect(times[0]).toBe(5.0);
        });

        it('should use default subdivisions of 2', () => {
            const pattern = [true, true];
            const times = patternToTimes(pattern, 60);
            expect(times[1]).toBeCloseTo(0.5);
        });

        it('should handle empty pattern', () => {
            expect(patternToTimes([], 120)).toEqual([]);
        });

        it('should handle all false pattern', () => {
            expect(patternToTimes([false, false, false], 120)).toEqual([]);
        });

        it('should handle single hit pattern', () => {
            const times = patternToTimes([true], 60, 1, 0);
            expect(times).toEqual([0]);
        });
    });

    describe('repeatPatternTimes', () => {
        it('should repeat pattern to fill duration', () => {
            const pattern = [true, false];
            const times = repeatPatternTimes(pattern, 60, 3.5, 1);
            expect(times).toEqual([0, 2]);
        });

        it('should cut off hits exceeding duration', () => {
            const pattern = [true, true];
            const times = repeatPatternTimes(pattern, 60, 1.5, 1);
            expect(times).toEqual([0, 1]);
        });

        it('should handle pattern longer than duration', () => {
            const pattern = [true, true, true, true];
            const times = repeatPatternTimes(pattern, 60, 1, 1);
            expect(times).toEqual([0]);
        });

        it('should handle empty pattern', () => {
            expect(repeatPatternTimes([], 60, 10, 1)).toEqual([]);
        });

        it('should handle zero duration', () => {
            const pattern = [true, true];
            const times = repeatPatternTimes(pattern, 60, 0, 1);
            expect(times).toEqual([]);
        });

        it('should handle all false pattern', () => {
            const pattern = [false, false];
            const times = repeatPatternTimes(pattern, 60, 10, 1);
            expect(times).toEqual([]);
        });
    });

    describe('getPresetPattern', () => {
        it('should return correct tresillo pattern', () => {
            const tresillo = getPresetPattern('tresillo');
            expect(tresillo).toHaveLength(8);
            expect(tresillo.filter(Boolean).length).toBe(3);
        });

        it('should return correct cinquillo pattern', () => {
            const cinquillo = getPresetPattern('cinquillo');
            expect(cinquillo).toHaveLength(8);
            expect(cinquillo.filter(Boolean).length).toBe(5);
        });

        it('should return empty array for unknown preset', () => {
            expect(getPresetPattern('unknown-rhythm')).toEqual([]);
        });

        it('should return empty array for empty string', () => {
            expect(getPresetPattern('')).toEqual([]);
        });

        it('should contain expected preset keys', () => {
            const keys = Object.keys(RHYTHM_PRESETS);
            expect(keys).toContain('tresillo');
            expect(keys).toContain('cinquillo');
            expect(keys).toContain('bossa-nova');
            expect(keys).toContain('rumba');
            expect(keys).toContain('quarter');
            expect(keys).toContain('eighth');
            expect(keys).toContain('triplet');
            expect(keys).toContain('african-bell');
            expect(keys).toContain('aksak');
        });
    });

    describe('getPatternDensity', () => {
        it('should calculate 50% density', () => {
            expect(getPatternDensity([true, false, true, false])).toBe(0.5);
        });

        it('should calculate 100% density', () => {
            expect(getPatternDensity([true, true, true, true])).toBe(1.0);
        });

        it('should calculate 0% density', () => {
            expect(getPatternDensity([false, false])).toBe(0.0);
        });

        it('should handle empty pattern (avoid division by zero)', () => {
            expect(getPatternDensity([])).toBe(0);
        });

        it('should calculate fractional density', () => {
            expect(getPatternDensity([true, false, false])).toBeCloseTo(1/3);
        });
    });

    describe('combinePatterns', () => {
        it('should combine patterns using OR logic', () => {
            const p1 = [true, false, false];
            const p2 = [false, true, false];
            expect(combinePatterns(p1, p2)).toEqual([true, true, false]);
        });

        it('should combine identical patterns', () => {
            const p = [true, false, true];
            expect(combinePatterns(p, p)).toEqual([true, false, true]);
        });

        it('should wrap shorter patterns to match length of longest', () => {
            const p1 = [true, false];
            const p2 = [false, false, true];
            expect(combinePatterns(p1, p2)).toEqual([true, false, true]);
        });

        it('should handle first pattern empty', () => {
            expect(combinePatterns([], [true, false])).toEqual([true, false]);
        });

        it('should handle second pattern empty', () => {
            expect(combinePatterns([true, false], [])).toEqual([true, false]);
        });

        it('should handle both patterns empty', () => {
            expect(combinePatterns([], [])).toEqual([]);
        });

        it('should handle all true patterns', () => {
            expect(combinePatterns([true, true], [true, true])).toEqual([true, true]);
        });

        it('should handle all false patterns', () => {
            expect(combinePatterns([false, false], [false, false])).toEqual([false, false]);
        });
    });

    describe('invertPattern', () => {
        it('should invert boolean values', () => {
            expect(invertPattern([true, false, true])).toEqual([false, true, false]);
        });

        it('should invert all true pattern', () => {
            expect(invertPattern([true, true, true])).toEqual([false, false, false]);
        });

        it('should invert all false pattern', () => {
            expect(invertPattern([false, false])).toEqual([true, true]);
        });

        it('should handle empty array', () => {
            expect(invertPattern([])).toEqual([]);
        });

        it('should handle single element', () => {
            expect(invertPattern([true])).toEqual([false]);
            expect(invertPattern([false])).toEqual([true]);
        });

        it('should be its own inverse (double invert)', () => {
            const pattern = [true, false, true, false];
            expect(invertPattern(invertPattern(pattern))).toEqual(pattern);
        });
    });
});
