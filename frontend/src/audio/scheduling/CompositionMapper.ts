/**
 * Maps composition data from Gemini to scheduled note events.
 */

import type { Composition, Instrument, CompositionParams } from '../../types/music';
import type { ScheduledNote, InstrumentTrack } from '../types';
import { SECTION_DURATION, PENTATONIC_INTERVALS } from '../types';
import { noteToFrequency, transposeNote, noteToMidi } from '../utils/frequencies';
import { ROLE_VELOCITY, ROLE_OCTAVE_OFFSET, rhythmToDuration } from '../utils/moodParams';
import { numericToBoolean, repeatPatternTimes, generateEuclidean } from './EuclideanRhythm';

/**
 * Map a composition to instrument tracks with scheduled notes.
 *
 * @param composition - Composition data from Gemini
 * @param params - Original composition parameters
 * @returns Map of instrument to its track data
 */
export function mapCompositionToTracks(
    composition: Composition,
    params: CompositionParams
): Map<Instrument, InstrumentTrack> {
    const tracks = new Map<Instrument, InstrumentTrack>();
    const totalDuration = composition.form.length * SECTION_DURATION;

    for (const instrument of params.instruments) {
        const role = composition.instrumentRoles[instrument] || 'accompaniment';
        const pattern = composition.euclideanPatterns[instrument] ||
            composition.euclideanPatterns[role] ||
            generateEuclidean(5, 8); // Fallback pattern

        const notes = generateInstrumentNotes(
            composition,
            instrument,
            role,
            pattern,
            params.tempo,
            totalDuration
        );

        tracks.set(instrument, {
            instrument,
            role,
            notes,
        });
    }

    return tracks;
}

/**
 * Generate all notes for an instrument based on its role.
 */
function generateInstrumentNotes(
    composition: Composition,
    instrument: Instrument,
    role: string,
    pattern: number[],
    tempo: number,
    totalDuration: number
): ScheduledNote[] {
    const notes: ScheduledNote[] = [];
    const boolPattern = numericToBoolean(pattern);
    const velocity = ROLE_VELOCITY[role] || 0.7;
    const octaveOffset = ROLE_OCTAVE_OFFSET[role] || 0;

    // Get hit times from the euclidean pattern
    const hitTimes = repeatPatternTimes(boolPattern, tempo, totalDuration, 2);

    // Generate notes based on role
    switch (role) {
        case 'melody':
            generateMelodyNotes(notes, composition, hitTimes, instrument, velocity, octaveOffset, tempo);
            break;
        case 'countermelody':
            generateCountermelodyNotes(notes, composition, hitTimes, instrument, velocity, octaveOffset, tempo);
            break;
        case 'bass':
            generateBassNotes(notes, composition, hitTimes, instrument, velocity, octaveOffset, tempo);
            break;
        case 'accompaniment':
        default:
            generateAccompanimentNotes(notes, composition, hitTimes, instrument, velocity, octaveOffset, tempo);
            break;
    }

    return notes;
}

/**
 * Generate melody notes following the motif pattern.
 */
function generateMelodyNotes(
    notes: ScheduledNote[],
    composition: Composition,
    hitTimes: number[],
    instrument: Instrument,
    baseVelocity: number,
    octaveOffset: number,
    tempo: number
): void {
    const { scale, motif, form } = composition;
    const motifPitches = motif.pitches;
    const motifRhythm = motif.rhythm;

    let motifIndex = 0;
    let sectionIndex = 0;

    for (const startTime of hitTimes) {
        // Determine which section we're in
        const newSectionIndex = Math.floor(startTime / SECTION_DURATION);
        if (newSectionIndex !== sectionIndex) {
            sectionIndex = newSectionIndex;
            // Reset or vary motif for new section
            if (form[sectionIndex]?.includes('B')) {
                motifIndex = Math.floor(motifPitches.length / 2); // Start mid-motif for contrast
            }
        }

        // Get pitch from motif or scale
        const pitchIndex = motifIndex % motifPitches.length;
        let pitch = motifPitches[pitchIndex] || scale[pitchIndex % scale.length];

        // Apply octave offset
        if (octaveOffset !== 0) {
            pitch = transposeNote(pitch, octaveOffset * 12);
        }

        // Get rhythm value
        const rhythmValue = motifRhythm[pitchIndex % motifRhythm.length] || 1;
        const duration = rhythmToDuration(rhythmValue, tempo);

        // Add variation based on section
        const velocity = applyVelocityVariation(baseVelocity, form[sectionIndex]);

        notes.push({
            pitch,
            frequency: noteToFrequency(pitch),
            startTime,
            duration: Math.max(duration, 0.1),
            velocity,
            instrument,
        });

        motifIndex++;
    }
}

/**
 * Generate countermelody notes (complementary to melody).
 */
function generateCountermelodyNotes(
    notes: ScheduledNote[],
    composition: Composition,
    hitTimes: number[],
    instrument: Instrument,
    baseVelocity: number,
    octaveOffset: number,
    tempo: number
): void {
    const { scale, motif, form } = composition;

    // Countermelody uses inverted or delayed motif
    let scaleIndex = 2; // Start on third degree
    const rhythmValues = motif.rhythm.map(r => r * 0.75); // Slightly shorter

    for (const startTime of hitTimes) {
        const sectionIndex = Math.floor(startTime / SECTION_DURATION);
        const section = form[sectionIndex] || 'A';

        // Skip some notes in A sections for contrast
        if (section === 'A' && Math.random() > 0.7) {
            scaleIndex++;
            continue;
        }

        let pitch = scale[scaleIndex % scale.length];

        if (octaveOffset !== 0) {
            pitch = transposeNote(pitch, octaveOffset * 12);
        }

        const rhythmIndex = scaleIndex % rhythmValues.length;
        const duration = rhythmToDuration(rhythmValues[rhythmIndex] || 0.5, tempo);

        notes.push({
            pitch,
            frequency: noteToFrequency(pitch),
            startTime: startTime + rhythmToDuration(0.25, tempo), // Slight offset
            duration: Math.max(duration, 0.08),
            velocity: baseVelocity * (section.includes('B') ? 1.1 : 0.9),
            instrument,
        });

        // Move through scale in contrary motion
        scaleIndex += section.includes('B') ? 2 : 1;
    }
}

/**
 * Generate bass notes (root and fifth, lower octave).
 */
function generateBassNotes(
    notes: ScheduledNote[],
    composition: Composition,
    hitTimes: number[],
    instrument: Instrument,
    baseVelocity: number,
    octaveOffset: number,
    tempo: number
): void {
    const { scale, form } = composition;

    // Bass typically alternates between root (0) and fifth (3 in pentatonic)
    const bassPattern = [0, 3, 0, 2, 0, 3, 1, 3]; // Scale degrees
    let patternIndex = 0;

    for (const startTime of hitTimes) {
        const sectionIndex = Math.floor(startTime / SECTION_DURATION);
        const section = form[sectionIndex] || 'A';

        // Sparse bass in calm sections
        if (section === 'A' && patternIndex % 2 !== 0) {
            patternIndex++;
            continue;
        }

        const scaleDegree = bassPattern[patternIndex % bassPattern.length];
        let pitch = scale[scaleDegree % scale.length];

        // Apply bass octave offset (from ROLE_OCTAVE_OFFSET, typically -1 for bass)
        if (octaveOffset !== 0) {
            pitch = transposeNote(pitch, octaveOffset * 12);
        }

        // Bass notes are typically longer
        const duration = rhythmToDuration(1.5, tempo);

        notes.push({
            pitch,
            frequency: noteToFrequency(pitch),
            startTime,
            duration: Math.max(duration, 0.2),
            velocity: baseVelocity * (section.includes('B') ? 1.0 : 0.85),
            instrument,
        });

        patternIndex++;
    }
}

/**
 * Generate accompaniment notes (chordal, arpeggiated).
 */
function generateAccompanimentNotes(
    notes: ScheduledNote[],
    composition: Composition,
    hitTimes: number[],
    instrument: Instrument,
    baseVelocity: number,
    octaveOffset: number,
    tempo: number
): void {
    const { scale, form } = composition;

    // Accompaniment arpeggiates through chord tones
    const chordPattern = [0, 2, 4, 2]; // 1-3-5-3 pattern
    let patternIndex = 0;

    for (const startTime of hitTimes) {
        const sectionIndex = Math.floor(startTime / SECTION_DURATION);
        const section = form[sectionIndex] || 'A';

        const scaleDegree = chordPattern[patternIndex % chordPattern.length];
        let pitch = scale[scaleDegree % scale.length];

        if (octaveOffset !== 0) {
            pitch = transposeNote(pitch, octaveOffset * 12);
        }

        // Shorter, more rhythmic notes
        const duration = rhythmToDuration(0.5, tempo);

        // Add slight random velocity variation for organic feel
        const velocityVariation = 0.9 + Math.random() * 0.2;

        notes.push({
            pitch,
            frequency: noteToFrequency(pitch),
            startTime,
            duration: Math.max(duration, 0.08),
            velocity: baseVelocity * velocityVariation * (section.includes('B') ? 1.1 : 1.0),
            instrument,
        });

        patternIndex++;
    }
}

/**
 * Apply velocity variation based on section type.
 */
function applyVelocityVariation(baseVelocity: number, section: string): number {
    switch (section) {
        case 'A':
            return baseVelocity * 0.9;
        case "A'":
            return baseVelocity * 0.95;
        case 'B':
            return baseVelocity * 1.1;
        case "A''":
            return baseVelocity * 1.0;
        default:
            return baseVelocity;
    }
}

/**
 * Get the total duration of a composition.
 */
export function getCompositionDuration(composition: Composition): number {
    return composition.form.length * SECTION_DURATION;
}

/**
 * Build a scale from root note and mode.
 */
export function buildScale(root: string, mode: 'gong' | 'shang' | 'jue' | 'zhi' | 'yu', octave: number = 4): string[] {
    const intervals = PENTATONIC_INTERVALS[mode];
    const rootMidi = noteToMidi(`${root}${octave}`);

    return intervals.map(interval => {
        const midi = rootMidi + interval;
        return midiToNote(midi);
    });
}

/**
 * Convert MIDI number to note string.
 */
function midiToNote(midi: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return `${noteNames[noteIndex]}${octave}`;
}
