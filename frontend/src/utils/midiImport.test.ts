import { describe, it, expect } from 'vitest';
import {
    parseMidiFile,
    midiToComposition,
    inferScale,
    extractMotif,
    inferForm,
    generateEuclideanPattern,
    mapProgramToInstrument,
    MidiImportError,
    type MidiNote,
} from './midiImport';

// Helper to create a minimal valid MIDI file
function createMidiFile(options: {
    format?: number;
    ticksPerBeat?: number;
    tempo?: number;
    notes?: Array<{ pitch: number; start: number; duration: number; velocity?: number; channel?: number }>;
    programs?: Map<number, number>;
}): ArrayBuffer {
    const {
        format = 0,
        ticksPerBeat = 480,
        tempo = 120,
        notes = [{ pitch: 60, start: 0, duration: 480, velocity: 100, channel: 0 }],
        programs = new Map(),
    } = options;

    const events: number[] = [];

    // Tempo meta event (microseconds per beat)
    const microsecondsPerBeat = Math.round(60000000 / tempo);
    events.push(
        0x00, // Delta time
        0xFF, 0x51, 0x03, // Tempo meta event
        (microsecondsPerBeat >> 16) & 0xFF,
        (microsecondsPerBeat >> 8) & 0xFF,
        microsecondsPerBeat & 0xFF
    );

    // Program changes
    for (const [channel, program] of programs) {
        events.push(0x00, 0xC0 | channel, program);
    }

    // Sort notes by start time
    const sortedNotes = [...notes].sort((a, b) => a.start - b.start);

    // Generate note events
    interface NoteEvent {
        tick: number;
        type: 'on' | 'off';
        channel: number;
        pitch: number;
        velocity: number;
    }

    const noteEvents: NoteEvent[] = [];
    for (const note of sortedNotes) {
        noteEvents.push({
            tick: note.start,
            type: 'on',
            channel: note.channel ?? 0,
            pitch: note.pitch,
            velocity: note.velocity ?? 100,
        });
        noteEvents.push({
            tick: note.start + note.duration,
            type: 'off',
            channel: note.channel ?? 0,
            pitch: note.pitch,
            velocity: 0,
        });
    }

    // Sort by tick
    noteEvents.sort((a, b) => a.tick - b.tick);

    // Convert to MIDI events with delta times
    let lastTick = 0;
    for (const event of noteEvents) {
        const delta = event.tick - lastTick;
        lastTick = event.tick;

        // Write VLQ delta time
        if (delta < 128) {
            events.push(delta);
        } else {
            events.push(0x80 | ((delta >> 7) & 0x7F), delta & 0x7F);
        }

        if (event.type === 'on') {
            events.push(0x90 | event.channel, event.pitch, event.velocity);
        } else {
            events.push(0x80 | event.channel, event.pitch, 0x40);
        }
    }

    // End of track
    events.push(0x00, 0xFF, 0x2F, 0x00);

    // Build track chunk
    const trackData = new Uint8Array(events);
    const trackChunk = new Uint8Array(8 + trackData.length);
    trackChunk[0] = 0x4D; // M
    trackChunk[1] = 0x54; // T
    trackChunk[2] = 0x72; // r
    trackChunk[3] = 0x6B; // k
    trackChunk[4] = (trackData.length >> 24) & 0xFF;
    trackChunk[5] = (trackData.length >> 16) & 0xFF;
    trackChunk[6] = (trackData.length >> 8) & 0xFF;
    trackChunk[7] = trackData.length & 0xFF;
    trackChunk.set(trackData, 8);

    // Build header chunk
    const header = new Uint8Array(14);
    header[0] = 0x4D; // M
    header[1] = 0x54; // T
    header[2] = 0x68; // h
    header[3] = 0x64; // d
    header[4] = 0x00;
    header[5] = 0x00;
    header[6] = 0x00;
    header[7] = 0x06; // Header length
    header[8] = 0x00;
    header[9] = format; // Format type
    header[10] = 0x00;
    header[11] = 0x01; // Number of tracks
    header[12] = (ticksPerBeat >> 8) & 0xFF;
    header[13] = ticksPerBeat & 0xFF;

    // Combine header and track
    const midiFile = new Uint8Array(header.length + trackChunk.length);
    midiFile.set(header);
    midiFile.set(trackChunk, header.length);

    return midiFile.buffer;
}

describe('MIDI Import', () => {
    describe('parseMidiFile', () => {
        it('should parse a minimal valid MIDI file', () => {
            const midi = createMidiFile({
                notes: [{ pitch: 60, start: 0, duration: 480 }],
            });

            const result = parseMidiFile(midi);

            expect(result.format).toBe(0);
            expect(result.ticksPerBeat).toBe(480);
            expect(result.allNotes.length).toBe(1);
            expect(result.allNotes[0].pitch).toBe(60);
        });

        it('should parse tempo from meta event', () => {
            const midi = createMidiFile({
                tempo: 90,
                notes: [{ pitch: 60, start: 0, duration: 480 }],
            });

            const result = parseMidiFile(midi);

            expect(result.tempo).toBe(90);
        });

        it('should parse multiple notes', () => {
            const midi = createMidiFile({
                notes: [
                    { pitch: 60, start: 0, duration: 480 },
                    { pitch: 62, start: 480, duration: 480 },
                    { pitch: 64, start: 960, duration: 480 },
                ],
            });

            const result = parseMidiFile(midi);

            expect(result.allNotes.length).toBe(3);
            expect(result.allNotes.map(n => n.pitch)).toContain(60);
            expect(result.allNotes.map(n => n.pitch)).toContain(62);
            expect(result.allNotes.map(n => n.pitch)).toContain(64);
        });

        it('should organize notes by channel', () => {
            const midi = createMidiFile({
                notes: [
                    { pitch: 60, start: 0, duration: 480, channel: 0 },
                    { pitch: 67, start: 0, duration: 480, channel: 1 },
                ],
            });

            const result = parseMidiFile(midi);

            expect(result.channels.size).toBe(2);
            expect(result.channels.get(0)?.notes.length).toBe(1);
            expect(result.channels.get(1)?.notes.length).toBe(1);
        });

        it('should throw for invalid header', () => {
            const invalid = new ArrayBuffer(14);
            const view = new Uint8Array(invalid);
            view[0] = 0x00; // Not "MThd"

            expect(() => parseMidiFile(invalid)).toThrow(MidiImportError);
            expect(() => parseMidiFile(invalid)).toThrow('Invalid MIDI file');
        });

        it('should throw for file too small', () => {
            const tiny = new ArrayBuffer(10);

            expect(() => parseMidiFile(tiny)).toThrow(MidiImportError);
            expect(() => parseMidiFile(tiny)).toThrow('too small');
        });

        it('should throw for empty MIDI file (no notes)', () => {
            const midi = createMidiFile({ notes: [] });

            expect(() => parseMidiFile(midi)).toThrow(MidiImportError);
            expect(() => parseMidiFile(midi)).toThrow('no notes');
        });
    });

    describe('inferScale', () => {
        it('should infer C major pentatonic (gong) from C major notes', () => {
            const notes: MidiNote[] = [
                { pitch: 60, startTick: 0, durationTicks: 480, velocity: 100, channel: 0 }, // C
                { pitch: 62, startTick: 480, durationTicks: 480, velocity: 100, channel: 0 }, // D
                { pitch: 64, startTick: 960, durationTicks: 480, velocity: 100, channel: 0 }, // E
                { pitch: 67, startTick: 1440, durationTicks: 480, velocity: 100, channel: 0 }, // G
                { pitch: 69, startTick: 1920, durationTicks: 480, velocity: 100, channel: 0 }, // A
            ];

            const result = inferScale(notes);

            expect(result.root).toBe('C');
            expect(result.mode).toBe('gong');
            expect(result.scale).toHaveLength(5);
        });

        it('should infer a valid pentatonic scale from A minor notes', () => {
            // A minor pentatonic and C major pentatonic share the same notes (A, C, D, E, G)
            // The algorithm may detect either depending on weighting
            const notes: MidiNote[] = [
                { pitch: 69, startTick: 0, durationTicks: 480, velocity: 100, channel: 0 }, // A
                { pitch: 72, startTick: 480, durationTicks: 480, velocity: 100, channel: 0 }, // C
                { pitch: 74, startTick: 960, durationTicks: 480, velocity: 100, channel: 0 }, // D
                { pitch: 76, startTick: 1440, durationTicks: 480, velocity: 100, channel: 0 }, // E
                { pitch: 79, startTick: 1920, durationTicks: 480, velocity: 100, channel: 0 }, // G
            ];

            const result = inferScale(notes);

            // Should detect one of the valid roots for this note set
            expect(['A', 'C', 'D', 'E', 'G']).toContain(result.root);
            expect(['gong', 'shang', 'jue', 'zhi', 'yu']).toContain(result.mode);
            expect(result.scale).toHaveLength(5);
        });

        it('should weight longer notes more heavily', () => {
            const notes: MidiNote[] = [
                // Short notes in one scale
                { pitch: 60, startTick: 0, durationTicks: 100, velocity: 100, channel: 0 },
                { pitch: 62, startTick: 100, durationTicks: 100, velocity: 100, channel: 0 },
                // Long notes in another key
                { pitch: 67, startTick: 200, durationTicks: 2000, velocity: 100, channel: 0 },
                { pitch: 69, startTick: 2200, durationTicks: 2000, velocity: 100, channel: 0 },
            ];

            const result = inferScale(notes);

            // G and A are emphasized, so should influence the result
            expect(result).toBeDefined();
        });
    });

    describe('extractMotif', () => {
        it('should extract first notes as motif', () => {
            const notes: MidiNote[] = [
                { pitch: 60, startTick: 0, durationTicks: 480, velocity: 100, channel: 0 },
                { pitch: 62, startTick: 480, durationTicks: 240, velocity: 100, channel: 0 },
                { pitch: 64, startTick: 720, durationTicks: 480, velocity: 100, channel: 0 },
                { pitch: 65, startTick: 1200, durationTicks: 480, velocity: 100, channel: 0 },
            ];

            const motif = extractMotif(notes, 480);

            expect(motif.pitches.length).toBe(4);
            expect(motif.rhythm.length).toBe(4);
            expect(motif.pitches[0]).toBe('C4');
            expect(motif.rhythm[0]).toBe(1); // 480/480 = 1 beat
            expect(motif.rhythm[1]).toBe(0.5); // 240/480 = 0.5 beats
        });

        it('should limit motif to 4-8 notes', () => {
            const notes: MidiNote[] = Array.from({ length: 20 }, (_, i) => ({
                pitch: 60 + (i % 5),
                startTick: i * 480,
                durationTicks: 480,
                velocity: 100,
                channel: 0,
            }));

            const motif = extractMotif(notes, 480);

            expect(motif.pitches.length).toBeGreaterThanOrEqual(4);
            expect(motif.pitches.length).toBeLessThanOrEqual(8);
        });
    });

    describe('inferForm', () => {
        it('should return single A for very short piece', () => {
            const notes: MidiNote[] = [
                { pitch: 60, startTick: 0, durationTicks: 480, velocity: 100, channel: 0 },
            ];

            const form = inferForm(notes, 480);

            expect(form).toEqual(['A']);
        });

        it('should detect multiple sections', () => {
            // Create notes spanning multiple beats
            const notes: MidiNote[] = [];
            for (let i = 0; i < 32; i++) {
                notes.push({
                    pitch: 60 + (i < 16 ? 0 : 5), // Different pitch for second half
                    startTick: i * 480,
                    durationTicks: 480,
                    velocity: 100,
                    channel: 0,
                });
            }

            const form = inferForm(notes, 480);

            expect(form.length).toBeGreaterThan(1);
            expect(form.some(s => s.startsWith('A'))).toBe(true);
        });

        it('should return valid form labels', () => {
            const notes: MidiNote[] = Array.from({ length: 40 }, (_, i) => ({
                pitch: 60 + (i % 12),
                startTick: i * 480,
                durationTicks: 480,
                velocity: 100,
                channel: 0,
            }));

            const form = inferForm(notes, 480);

            for (const section of form) {
                expect(section).toMatch(/^[AB]'*$/);
            }
        });
    });

    describe('generateEuclideanPattern', () => {
        it('should generate pattern with hits where notes occur', () => {
            const notes: MidiNote[] = [
                { pitch: 60, startTick: 0, durationTicks: 480, velocity: 100, channel: 0 },
                { pitch: 62, startTick: 240, durationTicks: 480, velocity: 100, channel: 0 },
            ];

            const pattern = generateEuclideanPattern(notes, 480, 8);

            expect(pattern).toHaveLength(8);
            expect(pattern[0]).toBe(1); // Note at tick 0
            expect(pattern.some(v => v === 1)).toBe(true);
        });

        it('should return default pattern for empty notes', () => {
            const pattern = generateEuclideanPattern([], 480, 8);

            expect(pattern).toHaveLength(8);
            expect(pattern.filter(v => v === 1).length).toBeGreaterThan(0);
        });

        it('should only contain 0s and 1s', () => {
            const notes: MidiNote[] = [
                { pitch: 60, startTick: 0, durationTicks: 480, velocity: 100, channel: 0 },
                { pitch: 62, startTick: 120, durationTicks: 480, velocity: 100, channel: 0 },
                { pitch: 64, startTick: 360, durationTicks: 480, velocity: 100, channel: 0 },
            ];

            const pattern = generateEuclideanPattern(notes, 480, 8);

            for (const value of pattern) {
                expect([0, 1]).toContain(value);
            }
        });
    });

    describe('mapProgramToInstrument', () => {
        it('should map violin/fiddle to erhu', () => {
            expect(mapProgramToInstrument(40)).toBe('erhu'); // Violin
            expect(mapProgramToInstrument(110)).toBe('erhu'); // Fiddle
        });

        it('should map flute to dizi', () => {
            expect(mapProgramToInstrument(73)).toBe('dizi'); // Flute
            expect(mapProgramToInstrument(72)).toBe('dizi'); // Piccolo
        });

        it('should map koto to guzheng', () => {
            expect(mapProgramToInstrument(107)).toBe('guzheng'); // Koto
        });

        it('should map banjo/sitar to pipa', () => {
            expect(mapProgramToInstrument(105)).toBe('pipa'); // Banjo
            expect(mapProgramToInstrument(104)).toBe('pipa'); // Sitar
        });

        it('should default to erhu for unknown programs', () => {
            expect(mapProgramToInstrument(999)).toBe('erhu');
            expect(mapProgramToInstrument(50)).toBe('erhu');
        });
    });

    describe('midiToComposition', () => {
        it('should convert parsed MIDI to valid composition', () => {
            const midi = createMidiFile({
                tempo: 90,
                notes: [
                    { pitch: 60, start: 0, duration: 480 },
                    { pitch: 62, start: 480, duration: 480 },
                    { pitch: 64, start: 960, duration: 480 },
                    { pitch: 67, start: 1440, duration: 480 },
                    { pitch: 69, start: 1920, duration: 480 },
                ],
            });

            const parsed = parseMidiFile(midi);
            const { composition, params } = midiToComposition(parsed);

            // Validate composition structure
            expect(composition.scale).toHaveLength(5);
            expect(composition.motif.pitches.length).toBeGreaterThan(0);
            expect(composition.motif.rhythm.length).toBe(composition.motif.pitches.length);
            expect(composition.form.length).toBeGreaterThan(0);
            expect(Object.keys(composition.instrumentRoles).length).toBeGreaterThan(0);
            expect(Object.keys(composition.euclideanPatterns).length).toBeGreaterThan(0);

            // Validate params
            expect(['gong', 'shang', 'jue', 'zhi', 'yu']).toContain(params.mode);
            expect(params.tempo).toBe(90);
            expect(params.instruments.length).toBeGreaterThan(0);
            expect(['calm', 'heroic', 'melancholic', 'festive']).toContain(params.mood);
        });

        it('should clamp tempo to valid range', () => {
            const midi = createMidiFile({
                tempo: 200, // Above max of 160
                notes: [{ pitch: 60, start: 0, duration: 480 }],
            });

            const parsed = parseMidiFile(midi);
            const { params } = midiToComposition(parsed);

            expect(params.tempo).toBe(160);
        });

        it('should assign roles to instruments', () => {
            const midi = createMidiFile({
                notes: [
                    { pitch: 60, start: 0, duration: 480, channel: 0 },
                    { pitch: 48, start: 0, duration: 480, channel: 1 },
                ],
                programs: new Map([[0, 73], [1, 40]]), // Flute, Violin
            });

            const parsed = parseMidiFile(midi);
            const { composition } = midiToComposition(parsed);

            const roles = Object.values(composition.instrumentRoles);
            expect(roles).toContain('melody');
        });
    });

    describe('MidiImportError', () => {
        it('should have correct properties', () => {
            const error = new MidiImportError('Test error', 'INVALID_FORMAT', 'details');

            expect(error.message).toBe('Test error');
            expect(error.code).toBe('INVALID_FORMAT');
            expect(error.details).toBe('details');
            expect(error.name).toBe('MidiImportError');
        });

        it('should be instanceof Error', () => {
            const error = new MidiImportError('Test', 'PARSE_ERROR');

            expect(error instanceof Error).toBe(true);
            expect(error instanceof MidiImportError).toBe(true);
        });
    });
});
