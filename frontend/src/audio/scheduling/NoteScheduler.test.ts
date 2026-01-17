/**
 * Unit tests for NoteScheduler.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    scheduleTrack,
    scheduleAllTracks,
    createSimpleScheduler,
    getNotesDensity,
    getTrackTimeRange,
    filterNotesInRange,
    quantizeNotes,
    humanizeNotes,
    sortNotesByTime,
    mergeTracksNotes,
} from './NoteScheduler';
import type { SchedulingContext, NoteScheduleCallback } from './NoteScheduler';
import type { ScheduledNote, InstrumentTrack } from '../types';
import type { Instrument } from '../../types/music';

// Helper to create mock notes
function createMockNote(overrides: Partial<ScheduledNote> = {}): ScheduledNote {
    return {
        pitch: 'C4',
        frequency: 261.63,
        startTime: 0,
        duration: 1,
        velocity: 0.8,
        instrument: 'erhu',
        ...overrides,
    };
}

// Helper to create mock track
function createMockTrack(notes: ScheduledNote[], instrument: Instrument = 'erhu'): InstrumentTrack {
    return {
        instrument,
        role: 'melody',
        notes,
    };
}

// Mock AudioContext
function createMockAudioContext() {
    const mockOscillator = {
        type: 'sine',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
    };

    const mockGain = {
        gain: {
            value: 1,
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
    };

    return {
        createOscillator: vi.fn(() => mockOscillator),
        createGain: vi.fn(() => mockGain),
        currentTime: 0,
        _mockOscillator: mockOscillator,
        _mockGain: mockGain,
    } as unknown as BaseAudioContext & { _mockOscillator: typeof mockOscillator; _mockGain: typeof mockGain };
}

describe('NoteScheduler', () => {
    describe('scheduleTrack', () => {
        let mockContext: SchedulingContext;
        let mockCallback: NoteScheduleCallback;
        let mockDestination: AudioNode;

        beforeEach(() => {
            mockDestination = {} as AudioNode;
            mockCallback = vi.fn();
            mockContext = {
                audioContext: createMockAudioContext(),
                destinations: new Map([['erhu', mockDestination]]),
                timeOffset: 0,
            };
        });

        it('calls scheduleNote for each note in track', () => {
            const notes = [
                createMockNote({ startTime: 0 }),
                createMockNote({ startTime: 1 }),
                createMockNote({ startTime: 2 }),
            ];
            const track = createMockTrack(notes);

            scheduleTrack(track, mockContext, mockCallback);

            expect(mockCallback).toHaveBeenCalledTimes(3);
        });

        it('passes destination node to callback', () => {
            const track = createMockTrack([createMockNote()]);

            scheduleTrack(track, mockContext, mockCallback);

            expect(mockCallback).toHaveBeenCalledWith(
                expect.any(Object),
                mockDestination,
                mockContext.audioContext
            );
        });

        it('applies timeOffset to note start times', () => {
            const note = createMockNote({ startTime: 5 });
            const track = createMockTrack([note]);
            mockContext.timeOffset = 2;

            scheduleTrack(track, mockContext, mockCallback);

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({ startTime: 7 }),
                expect.any(Object),
                expect.any(Object)
            );
        });

        it('skips notes with negative adjusted start time', () => {
            const note = createMockNote({ startTime: 1 });
            const track = createMockTrack([note]);
            mockContext.timeOffset = -5;

            scheduleTrack(track, mockContext, mockCallback);

            expect(mockCallback).not.toHaveBeenCalled();
        });

        it('does not call callback if no destination found', () => {
            const track = createMockTrack([createMockNote()], 'guzheng');

            scheduleTrack(track, mockContext, mockCallback);

            expect(mockCallback).not.toHaveBeenCalled();
        });

        it('handles empty track', () => {
            const track = createMockTrack([]);

            scheduleTrack(track, mockContext, mockCallback);

            expect(mockCallback).not.toHaveBeenCalled();
        });
    });

    describe('scheduleAllTracks', () => {
        it('schedules all tracks in the map', () => {
            const mockCallback = vi.fn();
            const erhuDest = {} as AudioNode;
            const guzhengDest = {} as AudioNode;

            const mockContext: SchedulingContext = {
                audioContext: createMockAudioContext(),
                destinations: new Map([
                    ['erhu', erhuDest],
                    ['guzheng', guzhengDest],
                ]),
                timeOffset: 0,
            };

            const tracks = new Map<Instrument, InstrumentTrack>([
                ['erhu', createMockTrack([createMockNote()], 'erhu')],
                ['guzheng', createMockTrack([createMockNote({ instrument: 'guzheng' })], 'guzheng')],
            ]);

            scheduleAllTracks(tracks, mockContext, mockCallback);

            expect(mockCallback).toHaveBeenCalledTimes(2);
        });

        it('handles empty tracks map', () => {
            const mockCallback = vi.fn();
            const mockContext: SchedulingContext = {
                audioContext: createMockAudioContext(),
                destinations: new Map(),
                timeOffset: 0,
            };

            scheduleAllTracks(new Map(), mockContext, mockCallback);

            expect(mockCallback).not.toHaveBeenCalled();
        });
    });

    describe('createSimpleScheduler', () => {
        it('returns a function', () => {
            const scheduler = createSimpleScheduler();
            expect(typeof scheduler).toBe('function');
        });

        it('creates oscillator and gain nodes', () => {
            const ctx = createMockAudioContext();
            const destination = {} as AudioNode;
            const scheduler = createSimpleScheduler();

            scheduler(createMockNote(), destination, ctx);

            expect(ctx.createOscillator).toHaveBeenCalled();
            expect(ctx.createGain).toHaveBeenCalled();
        });

        it('sets oscillator frequency from note', () => {
            const ctx = createMockAudioContext();
            const note = createMockNote({ frequency: 440 });
            const scheduler = createSimpleScheduler();

            scheduler(note, {} as AudioNode, ctx);

            expect(ctx._mockOscillator.frequency.value).toBe(440);
        });

        it('schedules oscillator start and stop', () => {
            const ctx = createMockAudioContext();
            const note = createMockNote({ startTime: 2, duration: 1 });
            const scheduler = createSimpleScheduler();

            scheduler(note, {} as AudioNode, ctx);

            expect(ctx._mockOscillator.start).toHaveBeenCalledWith(2);
            expect(ctx._mockOscillator.stop).toHaveBeenCalledWith(3.1); // duration + 0.1
        });

        it('connects nodes to destination', () => {
            const ctx = createMockAudioContext();
            const destination = {} as AudioNode;
            const scheduler = createSimpleScheduler();

            scheduler(createMockNote(), destination, ctx);

            expect(ctx._mockOscillator.connect).toHaveBeenCalledWith(ctx._mockGain);
            expect(ctx._mockGain.connect).toHaveBeenCalledWith(destination);
        });
    });

    describe('getNotesDensity', () => {
        it('calculates notes per second correctly', () => {
            const notes = [
                createMockNote({ startTime: 0, duration: 1 }),
                createMockNote({ startTime: 1, duration: 1 }),
                createMockNote({ startTime: 2, duration: 1 }),
                createMockNote({ startTime: 3, duration: 1 }),
            ];
            const track = createMockTrack(notes);

            const density = getNotesDensity(track);

            // 4 notes over 4 seconds = 1 note per second
            expect(density).toBe(1);
        });

        it('returns 0 for track with less than 2 notes', () => {
            const singleNote = createMockTrack([createMockNote()]);
            const empty = createMockTrack([]);

            expect(getNotesDensity(singleNote)).toBe(0);
            expect(getNotesDensity(empty)).toBe(0);
        });

        it('returns 0 if duration is zero or negative', () => {
            const notes = [
                createMockNote({ startTime: 0, duration: 0 }),
                createMockNote({ startTime: 0, duration: 0 }),
            ];
            const track = createMockTrack(notes);

            expect(getNotesDensity(track)).toBe(0);
        });
    });

    describe('getTrackTimeRange', () => {
        it('returns correct start and end times', () => {
            const notes = [
                createMockNote({ startTime: 1, duration: 0.5 }),
                createMockNote({ startTime: 3, duration: 2 }),
            ];
            const track = createMockTrack(notes);

            const range = getTrackTimeRange(track);

            expect(range.start).toBe(1);
            expect(range.end).toBe(5); // 3 + 2
        });

        it('returns zero range for empty track', () => {
            const track = createMockTrack([]);

            const range = getTrackTimeRange(track);

            expect(range.start).toBe(0);
            expect(range.end).toBe(0);
        });

        it('handles single note track', () => {
            const note = createMockNote({ startTime: 2, duration: 1 });
            const track = createMockTrack([note]);

            const range = getTrackTimeRange(track);

            expect(range.start).toBe(2);
            expect(range.end).toBe(3);
        });
    });

    describe('filterNotesInRange', () => {
        it('includes notes that overlap with range', () => {
            const notes = [
                createMockNote({ startTime: 0, duration: 2 }),   // 0-2
                createMockNote({ startTime: 3, duration: 1 }),   // 3-4
                createMockNote({ startTime: 5, duration: 1 }),   // 5-6
            ];

            const filtered = filterNotesInRange(notes, 1, 4);

            expect(filtered.length).toBe(2);
        });

        it('excludes notes completely outside range', () => {
            const notes = [
                createMockNote({ startTime: 0, duration: 1 }),   // 0-1
                createMockNote({ startTime: 10, duration: 1 }),  // 10-11
            ];

            const filtered = filterNotesInRange(notes, 2, 5);

            expect(filtered.length).toBe(0);
        });

        it('includes notes that start before but end during range', () => {
            const note = createMockNote({ startTime: 0, duration: 3 }); // 0-3

            const filtered = filterNotesInRange([note], 2, 5);

            expect(filtered.length).toBe(1);
        });

        it('includes notes that start during but end after range', () => {
            const note = createMockNote({ startTime: 4, duration: 3 }); // 4-7

            const filtered = filterNotesInRange([note], 2, 5);

            expect(filtered.length).toBe(1);
        });
    });

    describe('quantizeNotes', () => {
        it('rounds note start times to grid', () => {
            const notes = [
                createMockNote({ startTime: 0.13 }),
                createMockNote({ startTime: 0.26 }),
                createMockNote({ startTime: 0.52 }),
            ];

            const quantized = quantizeNotes(notes, 0.25);

            expect(quantized[0].startTime).toBe(0);
            expect(quantized[1].startTime).toBe(0.25);
            expect(quantized[2].startTime).toBe(0.5);
        });

        it('preserves other note properties', () => {
            const note = createMockNote({
                startTime: 0.13,
                pitch: 'A4',
                velocity: 0.9,
            });

            const [quantized] = quantizeNotes([note], 0.25);

            expect(quantized.pitch).toBe('A4');
            expect(quantized.velocity).toBe(0.9);
        });
    });

    describe('humanizeNotes', () => {
        it('adds timing variation within maxOffset', () => {
            const notes = [createMockNote({ startTime: 1 })];

            const humanized = humanizeNotes(notes, 0.02);

            // Should be within range (0.98 to 1.02)
            expect(humanized[0].startTime).toBeGreaterThanOrEqual(0.98);
            expect(humanized[0].startTime).toBeLessThanOrEqual(1.02);
        });

        it('adds velocity variation', () => {
            const notes = [createMockNote({ velocity: 0.8 })];

            const humanized = humanizeNotes(notes, 0.02);

            // Velocity should be within range (0.95 * 0.8 to 1.05 * 0.8)
            expect(humanized[0].velocity).toBeGreaterThanOrEqual(0.76);
            expect(humanized[0].velocity).toBeLessThanOrEqual(0.84);
        });

        it('uses default maxOffset of 0.02', () => {
            const notes = [createMockNote({ startTime: 1 })];

            const humanized = humanizeNotes(notes);

            expect(humanized[0].startTime).toBeGreaterThanOrEqual(0.98);
            expect(humanized[0].startTime).toBeLessThanOrEqual(1.02);
        });
    });

    describe('sortNotesByTime', () => {
        it('sorts notes in ascending order by start time', () => {
            const notes = [
                createMockNote({ startTime: 3 }),
                createMockNote({ startTime: 1 }),
                createMockNote({ startTime: 2 }),
            ];

            const sorted = sortNotesByTime(notes);

            expect(sorted[0].startTime).toBe(1);
            expect(sorted[1].startTime).toBe(2);
            expect(sorted[2].startTime).toBe(3);
        });

        it('does not mutate original array', () => {
            const notes = [
                createMockNote({ startTime: 3 }),
                createMockNote({ startTime: 1 }),
            ];

            const sorted = sortNotesByTime(notes);

            expect(notes[0].startTime).toBe(3);
            expect(sorted).not.toBe(notes);
        });

        it('handles empty array', () => {
            expect(sortNotesByTime([])).toEqual([]);
        });

        it('handles already sorted array', () => {
            const notes = [
                createMockNote({ startTime: 1 }),
                createMockNote({ startTime: 2 }),
            ];

            const sorted = sortNotesByTime(notes);

            expect(sorted[0].startTime).toBe(1);
            expect(sorted[1].startTime).toBe(2);
        });
    });

    describe('mergeTracksNotes', () => {
        it('combines notes from multiple tracks', () => {
            const track1 = createMockTrack([
                createMockNote({ startTime: 0, instrument: 'erhu' }),
                createMockNote({ startTime: 2, instrument: 'erhu' }),
            ]);
            const track2 = createMockTrack([
                createMockNote({ startTime: 1, instrument: 'guzheng' }),
            ], 'guzheng');

            const merged = mergeTracksNotes([track1, track2]);

            expect(merged.length).toBe(3);
        });

        it('sorts merged notes by time', () => {
            const track1 = createMockTrack([createMockNote({ startTime: 2 })]);
            const track2 = createMockTrack([createMockNote({ startTime: 1 })], 'guzheng');

            const merged = mergeTracksNotes([track1, track2]);

            expect(merged[0].startTime).toBe(1);
            expect(merged[1].startTime).toBe(2);
        });

        it('handles empty tracks', () => {
            const track1 = createMockTrack([]);
            const track2 = createMockTrack([createMockNote()], 'guzheng');

            const merged = mergeTracksNotes([track1, track2]);

            expect(merged.length).toBe(1);
        });

        it('handles no tracks', () => {
            expect(mergeTracksNotes([])).toEqual([]);
        });
    });
});
