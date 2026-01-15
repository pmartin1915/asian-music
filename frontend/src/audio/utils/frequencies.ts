/**
 * Note-to-frequency conversion utilities.
 * Uses A4 = 440Hz standard tuning.
 */

import { NOTE_OFFSETS } from '../types';

/** A4 frequency in Hz (standard tuning) */
const A4_FREQUENCY = 440;

/** A4 MIDI note number */
const A4_MIDI = 69;

/**
 * Parse a note string (e.g., "C4", "F#3") into its components.
 * @param note - Note string like "C4", "F#3", "Bb5"
 * @returns Object with note name and octave, or null if invalid
 */
export function parseNote(note: string): { name: string; octave: number } | null {
    const match = note.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
    if (!match) return null;

    const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    const octave = parseInt(match[2], 10);

    if (!(name in NOTE_OFFSETS) && !(name.replace('#', '#') in NOTE_OFFSETS)) {
        return null;
    }

    return { name, octave };
}

/**
 * Convert a note string to MIDI note number.
 * @param note - Note string like "C4", "F#3"
 * @returns MIDI note number (0-127), or -1 if invalid
 */
export function noteToMidi(note: string): number {
    const parsed = parseNote(note);
    if (!parsed) return -1;

    const { name, octave } = parsed;
    const noteOffset = NOTE_OFFSETS[name];
    if (noteOffset === undefined) return -1;

    // MIDI note = (octave + 1) * 12 + noteOffset
    // C4 = (4 + 1) * 12 + 0 = 60
    return (octave + 1) * 12 + noteOffset;
}

/**
 * Convert a MIDI note number to frequency in Hz.
 * @param midiNote - MIDI note number (0-127)
 * @returns Frequency in Hz
 */
export function midiToFrequency(midiNote: number): number {
    // f = 440 * 2^((n - 69) / 12)
    return A4_FREQUENCY * Math.pow(2, (midiNote - A4_MIDI) / 12);
}

/**
 * Convert a note string directly to frequency in Hz.
 * @param note - Note string like "C4", "F#3"
 * @returns Frequency in Hz, or 0 if invalid
 */
export function noteToFrequency(note: string): number {
    const midi = noteToMidi(note);
    if (midi < 0) return 0;
    return midiToFrequency(midi);
}

/**
 * Convert frequency to the nearest note string.
 * @param frequency - Frequency in Hz
 * @returns Note string like "C4", "F#3"
 */
export function frequencyToNote(frequency: number): string {
    // MIDI = 69 + 12 * log2(f / 440)
    const midi = Math.round(A4_MIDI + 12 * Math.log2(frequency / A4_FREQUENCY));
    return midiToNote(midi);
}

/**
 * Convert a MIDI note number to note string.
 * @param midiNote - MIDI note number
 * @returns Note string like "C4"
 */
export function midiToNote(midiNote: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteIndex = midiNote % 12;
    return `${noteNames[noteIndex]}${octave}`;
}

/**
 * Transpose a note by a number of semitones.
 * @param note - Note string like "C4"
 * @param semitones - Number of semitones to transpose (positive = up, negative = down)
 * @returns Transposed note string
 */
export function transposeNote(note: string, semitones: number): string {
    const midi = noteToMidi(note);
    if (midi < 0) return note;
    return midiToNote(midi + semitones);
}

/**
 * Get the frequency ratio for a number of cents.
 * @param cents - Pitch deviation in cents (100 cents = 1 semitone)
 * @returns Frequency multiplier
 */
export function centsToRatio(cents: number): number {
    return Math.pow(2, cents / 1200);
}

/**
 * Calculate the interval in semitones between two notes.
 * @param noteA - First note string
 * @param noteB - Second note string
 * @returns Interval in semitones (positive if B is higher)
 */
export function intervalBetween(noteA: string, noteB: string): number {
    const midiA = noteToMidi(noteA);
    const midiB = noteToMidi(noteB);
    if (midiA < 0 || midiB < 0) return 0;
    return midiB - midiA;
}

/**
 * Common note frequencies for quick lookup.
 */
export const COMMON_FREQUENCIES: Record<string, number> = {
    'C3': 130.81,
    'D3': 146.83,
    'E3': 164.81,
    'F3': 174.61,
    'G3': 196.00,
    'A3': 220.00,
    'B3': 246.94,
    'C4': 261.63,
    'D4': 293.66,
    'E4': 329.63,
    'F4': 349.23,
    'G4': 392.00,
    'A4': 440.00,
    'B4': 493.88,
    'C5': 523.25,
    'D5': 587.33,
    'E5': 659.26,
    'F5': 698.46,
    'G5': 783.99,
    'A5': 880.00,
    'B5': 987.77,
    'C6': 1046.50,
};
