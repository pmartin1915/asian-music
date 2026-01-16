/**
 * Unit tests for frequency and note conversion utilities.
 */

import { describe, it, expect } from 'vitest';
import {
    parseNote,
    noteToMidi,
    midiToFrequency,
    noteToFrequency,
    frequencyToNote,
    midiToNote,
    transposeNote,
    centsToRatio,
    intervalBetween,
    COMMON_FREQUENCIES
} from './frequencies';

describe('frequencies.ts', () => {

    describe('parseNote', () => {
        it('parses valid natural notes', () => {
            expect(parseNote('C4')).toEqual({ name: 'C', octave: 4 });
            expect(parseNote('A0')).toEqual({ name: 'A', octave: 0 });
            expect(parseNote('G5')).toEqual({ name: 'G', octave: 5 });
        });

        it('parses sharps and flats', () => {
            expect(parseNote('F#3')).toEqual({ name: 'F#', octave: 3 });
            expect(parseNote('Bb5')).toEqual({ name: 'Bb', octave: 5 });
            expect(parseNote('C#4')).toEqual({ name: 'C#', octave: 4 });
            expect(parseNote('Db4')).toEqual({ name: 'Db', octave: 4 });
        });

        it('parses negative octaves', () => {
            expect(parseNote('C-1')).toEqual({ name: 'C', octave: -1 });
            expect(parseNote('G#-2')).toEqual({ name: 'G#', octave: -2 });
        });

        it('handles lowercase input', () => {
            expect(parseNote('c4')).toEqual({ name: 'C', octave: 4 });
            expect(parseNote('db3')).toEqual({ name: 'Db', octave: 3 });
            expect(parseNote('f#5')).toEqual({ name: 'F#', octave: 5 });
        });

        it('returns null for invalid formats', () => {
            expect(parseNote('invalid')).toBeNull();
            expect(parseNote('H4')).toBeNull();
            expect(parseNote('C')).toBeNull();
            expect(parseNote('4')).toBeNull();
            expect(parseNote('')).toBeNull();
            expect(parseNote('C4C')).toBeNull();
        });
    });

    describe('noteToMidi', () => {
        it('converts standard notes to MIDI numbers', () => {
            expect(noteToMidi('C4')).toBe(60);
            expect(noteToMidi('A4')).toBe(69);
            expect(noteToMidi('C5')).toBe(72);
        });

        it('handles sharps and flats correctly', () => {
            expect(noteToMidi('C#4')).toBe(61);
            expect(noteToMidi('Db4')).toBe(61);
            expect(noteToMidi('F#4')).toBe(66);
            expect(noteToMidi('Gb4')).toBe(66);
        });

        it('handles octave boundaries', () => {
            expect(noteToMidi('C-1')).toBe(0);
            expect(noteToMidi('C0')).toBe(12);
            expect(noteToMidi('C3')).toBe(48);
        });

        it('returns -1 for invalid notes', () => {
            expect(noteToMidi('H5')).toBe(-1);
            expect(noteToMidi('invalid')).toBe(-1);
            expect(noteToMidi('')).toBe(-1);
        });
    });

    describe('midiToFrequency', () => {
        it('calculates A4 = 440 Hz exactly', () => {
            expect(midiToFrequency(69)).toBe(440);
        });

        it('calculates octaves of A correctly', () => {
            expect(midiToFrequency(57)).toBeCloseTo(220, 2);
            expect(midiToFrequency(81)).toBeCloseTo(880, 2);
            expect(midiToFrequency(45)).toBeCloseTo(110, 2);
        });

        it('calculates Middle C (C4)', () => {
            expect(midiToFrequency(60)).toBeCloseTo(261.63, 1);
        });

        it('handles low MIDI values', () => {
            expect(midiToFrequency(21)).toBeCloseTo(27.5, 1);
            expect(midiToFrequency(0)).toBeCloseTo(8.18, 1);
        });

        it('handles high MIDI values', () => {
            expect(midiToFrequency(127)).toBeCloseTo(12543.85, 0);
        });
    });

    describe('noteToFrequency', () => {
        it('converts note strings directly to Hz', () => {
            expect(noteToFrequency('A4')).toBe(440);
            expect(noteToFrequency('C4')).toBeCloseTo(261.63, 1);
        });

        it('handles enharmonic equivalents', () => {
            const freqSharp = noteToFrequency('C#4');
            const freqFlat = noteToFrequency('Db4');
            expect(freqSharp).toBeCloseTo(277.18, 1);
            expect(freqSharp).toBe(freqFlat);
        });

        it('returns 0 for invalid notes', () => {
            expect(noteToFrequency('invalid')).toBe(0);
            expect(noteToFrequency('H4')).toBe(0);
            expect(noteToFrequency('')).toBe(0);
        });
    });

    describe('midiToNote', () => {
        it('converts MIDI numbers back to note strings', () => {
            expect(midiToNote(60)).toBe('C4');
            expect(midiToNote(69)).toBe('A4');
            expect(midiToNote(72)).toBe('C5');
        });

        it('defaults to sharps for accidentals', () => {
            expect(midiToNote(61)).toBe('C#4');
            expect(midiToNote(66)).toBe('F#4');
            expect(midiToNote(68)).toBe('G#4');
        });

        it('handles negative octaves', () => {
            expect(midiToNote(0)).toBe('C-1');
            expect(midiToNote(11)).toBe('B-1');
            expect(midiToNote(12)).toBe('C0');
        });

        it('handles all natural notes in an octave', () => {
            expect(midiToNote(60)).toBe('C4');
            expect(midiToNote(62)).toBe('D4');
            expect(midiToNote(64)).toBe('E4');
            expect(midiToNote(65)).toBe('F4');
            expect(midiToNote(67)).toBe('G4');
            expect(midiToNote(69)).toBe('A4');
            expect(midiToNote(71)).toBe('B4');
        });
    });

    describe('frequencyToNote', () => {
        it('converts exact frequencies to nearest note', () => {
            expect(frequencyToNote(440)).toBe('A4');
            expect(frequencyToNote(261.63)).toBe('C4');
        });

        it('rounds slightly off frequencies to nearest note', () => {
            expect(frequencyToNote(442)).toBe('A4');
            expect(frequencyToNote(438)).toBe('A4');
        });

        it('handles very high/low frequencies', () => {
            expect(frequencyToNote(880)).toBe('A5');
            expect(frequencyToNote(220)).toBe('A3');
            expect(frequencyToNote(110)).toBe('A2');
        });
    });

    describe('transposeNote', () => {
        it('transposes notes up', () => {
            expect(transposeNote('C4', 2)).toBe('D4');
            expect(transposeNote('C4', 12)).toBe('C5');
            expect(transposeNote('A4', 3)).toBe('C5');
        });

        it('transposes notes down', () => {
            expect(transposeNote('C4', -2)).toBe('A#3');
            expect(transposeNote('A4', -12)).toBe('A3');
            expect(transposeNote('C4', -1)).toBe('B3');
        });

        it('handles zero transposition', () => {
            expect(transposeNote('C4', 0)).toBe('C4');
            expect(transposeNote('F#5', 0)).toBe('F#5');
        });

        it('returns original string for invalid notes', () => {
            expect(transposeNote('invalid', 2)).toBe('invalid');
            expect(transposeNote('H4', 2)).toBe('H4');
        });
    });

    describe('centsToRatio', () => {
        it('returns 1 for 0 cents', () => {
            expect(centsToRatio(0)).toBe(1);
        });

        it('calculates octave correctly (1200 cents)', () => {
            expect(centsToRatio(1200)).toBe(2);
            expect(centsToRatio(-1200)).toBe(0.5);
        });

        it('calculates semitone correctly (100 cents)', () => {
            expect(centsToRatio(100)).toBeCloseTo(1.0595, 3);
        });

        it('calculates perfect fifth approximately (702 cents)', () => {
            expect(centsToRatio(702)).toBeCloseTo(1.5, 2);
        });
    });

    describe('intervalBetween', () => {
        it('calculates semitones between notes', () => {
            expect(intervalBetween('C4', 'C#4')).toBe(1);
            expect(intervalBetween('C4', 'D4')).toBe(2);
            expect(intervalBetween('C4', 'C5')).toBe(12);
        });

        it('returns negative values if second note is lower', () => {
            expect(intervalBetween('C5', 'C4')).toBe(-12);
            expect(intervalBetween('D4', 'C4')).toBe(-2);
        });

        it('returns 0 for same note', () => {
            expect(intervalBetween('C4', 'C4')).toBe(0);
        });

        it('handles enharmonic equivalents', () => {
            expect(intervalBetween('C#4', 'Db4')).toBe(0);
            expect(intervalBetween('F#4', 'Gb4')).toBe(0);
        });

        it('returns 0 if either note is invalid', () => {
            expect(intervalBetween('C4', 'invalid')).toBe(0);
            expect(intervalBetween('invalid', 'C4')).toBe(0);
            expect(intervalBetween('invalid', 'invalid')).toBe(0);
        });
    });

    describe('COMMON_FREQUENCIES', () => {
        it('contains correct reference values', () => {
            expect(COMMON_FREQUENCIES['A4']).toBe(440);
            expect(COMMON_FREQUENCIES['C4']).toBeCloseTo(261.63, 1);
        });

        it('contains notes across multiple octaves', () => {
            expect(COMMON_FREQUENCIES['C3']).toBeDefined();
            expect(COMMON_FREQUENCIES['C4']).toBeDefined();
            expect(COMMON_FREQUENCIES['C5']).toBeDefined();
            expect(COMMON_FREQUENCIES['C6']).toBeDefined();
        });
    });
});
