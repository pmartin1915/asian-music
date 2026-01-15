/**
 * Euclidean rhythm generation utilities.
 * Creates evenly-distributed rhythmic patterns based on Euclidean algorithm.
 */

/**
 * Generate a Euclidean rhythm pattern.
 * Distributes K pulses as evenly as possible across N steps.
 *
 * @param pulses - Number of pulses (hits)
 * @param steps - Total number of steps
 * @returns Array of booleans where true = hit
 *
 * @example
 * generateEuclidean(3, 8) // [true, false, false, true, false, false, true, false]
 * generateEuclidean(5, 8) // [true, false, true, true, false, true, true, false]
 */
export function generateEuclidean(pulses: number, steps: number): boolean[] {
    if (pulses <= 0 || steps <= 0) return [];
    if (pulses >= steps) return new Array(steps).fill(true);

    // Bjorklund's algorithm implementation
    const pattern: number[] = [];
    const counts: number[] = [];
    const remainders: number[] = [];

    let divisor = steps - pulses;
    remainders.push(pulses);

    let level = 0;
    while (remainders[level] > 1) {
        counts.push(Math.floor(divisor / remainders[level]));
        const newRemainder = divisor % remainders[level];
        divisor = remainders[level];
        remainders.push(newRemainder);
        level++;
    }
    counts.push(divisor);

    // Build the pattern
    buildPattern(pattern, level, counts, remainders);

    // Convert to boolean array
    return pattern.map(p => p === 1);
}

/**
 * Recursive helper for Bjorklund's algorithm.
 */
function buildPattern(
    pattern: number[],
    level: number,
    counts: number[],
    remainders: number[]
): void {
    if (level === -1) {
        pattern.push(0);
    } else if (level === -2) {
        pattern.push(1);
    } else {
        for (let i = 0; i < counts[level]; i++) {
            buildPattern(pattern, level - 1, counts, remainders);
        }
        if (remainders[level] !== 0) {
            buildPattern(pattern, level - 2, counts, remainders);
        }
    }
}

/**
 * Convert a numeric pattern (from composition data) to boolean.
 *
 * @param pattern - Array of numbers where non-zero = hit
 * @returns Array of booleans
 */
export function numericToBoolean(pattern: number[]): boolean[] {
    return pattern.map(p => p !== 0);
}

/**
 * Rotate a pattern by a number of steps.
 *
 * @param pattern - Boolean rhythm pattern
 * @param rotation - Steps to rotate (positive = right)
 * @returns Rotated pattern
 */
export function rotatePattern<T>(pattern: T[], rotation: number): T[] {
    if (pattern.length === 0) return [];
    const len = pattern.length;
    const normalizedRotation = ((rotation % len) + len) % len;
    return [
        ...pattern.slice(normalizedRotation),
        ...pattern.slice(0, normalizedRotation),
    ];
}

/**
 * Expand a rhythmic pattern to absolute time positions.
 *
 * @param pattern - Boolean rhythm pattern
 * @param tempo - Beats per minute
 * @param subdivisions - Steps per beat (default: 2 = eighth notes)
 * @param startTime - Starting time offset in seconds
 * @returns Array of hit times in seconds
 */
export function patternToTimes(
    pattern: boolean[],
    tempo: number,
    subdivisions: number = 2,
    startTime: number = 0
): number[] {
    const stepDuration = 60 / tempo / subdivisions;
    const times: number[] = [];

    pattern.forEach((isHit, index) => {
        if (isHit) {
            times.push(startTime + index * stepDuration);
        }
    });

    return times;
}

/**
 * Generate times for a repeated pattern over a duration.
 *
 * @param pattern - Boolean rhythm pattern
 * @param tempo - Beats per minute
 * @param duration - Total duration in seconds
 * @param subdivisions - Steps per beat
 * @returns Array of hit times in seconds
 */
export function repeatPatternTimes(
    pattern: boolean[],
    tempo: number,
    duration: number,
    subdivisions: number = 2
): number[] {
    const stepDuration = 60 / tempo / subdivisions;
    const patternDuration = pattern.length * stepDuration;
    const repetitions = Math.ceil(duration / patternDuration);
    const times: number[] = [];

    for (let rep = 0; rep < repetitions; rep++) {
        const repStartTime = rep * patternDuration;
        pattern.forEach((isHit, index) => {
            if (isHit) {
                const time = repStartTime + index * stepDuration;
                if (time < duration) {
                    times.push(time);
                }
            }
        });
    }

    return times;
}

/**
 * Common Euclidean rhythm presets.
 */
export const RHYTHM_PRESETS: Record<string, { pulses: number; steps: number }> = {
    // Traditional patterns
    'tresillo': { pulses: 3, steps: 8 },       // Cuban tresillo
    'cinquillo': { pulses: 5, steps: 8 },      // Cuban cinquillo
    'bossa-nova': { pulses: 3, steps: 16 },    // Bossa nova
    'rumba': { pulses: 5, steps: 12 },         // Rumba clave

    // Simple patterns
    'quarter': { pulses: 4, steps: 16 },       // Quarter notes
    'eighth': { pulses: 8, steps: 16 },        // Eighth notes
    'triplet': { pulses: 3, steps: 12 },       // Triplets

    // Complex patterns
    'african-bell': { pulses: 7, steps: 12 },  // West African bell
    'aksak': { pulses: 4, steps: 9 },          // Turkish aksak
};

/**
 * Get a preset pattern by name.
 */
export function getPresetPattern(name: string): boolean[] {
    const preset = RHYTHM_PRESETS[name];
    if (!preset) return [];
    return generateEuclidean(preset.pulses, preset.steps);
}

/**
 * Calculate pattern density (ratio of hits to total steps).
 */
export function getPatternDensity(pattern: boolean[]): number {
    if (pattern.length === 0) return 0;
    const hits = pattern.filter(Boolean).length;
    return hits / pattern.length;
}

/**
 * Combine two patterns with OR logic.
 */
export function combinePatterns(a: boolean[], b: boolean[]): boolean[] {
    const maxLen = Math.max(a.length, b.length);
    const result: boolean[] = [];

    for (let i = 0; i < maxLen; i++) {
        const aVal = a[i % a.length] || false;
        const bVal = b[i % b.length] || false;
        result.push(aVal || bVal);
    }

    return result;
}

/**
 * Create a complementary pattern (inverted).
 */
export function invertPattern(pattern: boolean[]): boolean[] {
    return pattern.map(p => !p);
}
