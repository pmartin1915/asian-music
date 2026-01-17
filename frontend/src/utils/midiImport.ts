/**
 * MIDI file parser and converter for importing MIDI files into the Silk Road Composer.
 * Supports Type 0 (single track) and Type 1 (multi-track) MIDI files.
 */

import type { Composition, CompositionParams, PentatonicMode, Instrument, Mood, Motif } from '../types/music';

// MIDI note numbers for pitches (C4 = 60)
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Pentatonic mode intervals (semitones from root)
const PENTATONIC_MODES: Record<PentatonicMode, number[]> = {
    gong: [0, 2, 4, 7, 9],    // Major pentatonic: C D E G A
    shang: [0, 2, 5, 7, 10],  // C D F G Bb
    jue: [0, 3, 5, 8, 10],    // C Eb F Ab Bb
    zhi: [0, 2, 5, 7, 9],     // C D F G A
    yu: [0, 3, 5, 7, 10],     // Minor pentatonic: C Eb F G Bb
};

// General MIDI program to instrument mapping
const PROGRAM_TO_INSTRUMENT: Record<number, Instrument> = {
    // Strings (bowed) -> erhu
    40: 'erhu', 41: 'erhu', 42: 'erhu', 43: 'erhu', 44: 'erhu', 45: 'erhu', 46: 'erhu', 47: 'erhu',
    110: 'erhu', // Fiddle
    // Ethnic -> various
    104: 'pipa', // Sitar -> pipa
    105: 'pipa', // Banjo -> pipa
    106: 'guzheng', // Shamisen -> guzheng
    107: 'guzheng', // Koto -> guzheng
    // Flutes -> dizi
    72: 'dizi', 73: 'dizi', 74: 'dizi', 75: 'dizi', 76: 'dizi', 77: 'dizi', 78: 'dizi', 79: 'dizi',
    // Plucked strings -> guzheng/pipa
    24: 'guzheng', 25: 'guzheng', 26: 'guzheng', 27: 'guzheng', // Guitars
    // Piano and keys -> guzheng (closest plucked sound)
    0: 'guzheng', 1: 'guzheng', 2: 'guzheng', 3: 'guzheng', 4: 'guzheng', 5: 'guzheng', 6: 'guzheng', 7: 'guzheng',
};

export interface MidiNote {
    pitch: number;        // MIDI note number (0-127)
    startTick: number;    // Start time in ticks
    durationTicks: number; // Duration in ticks
    velocity: number;     // Velocity (0-127)
    channel: number;      // MIDI channel (0-15)
}

export interface MidiChannel {
    program: number;
    notes: MidiNote[];
}

export interface MidiParseResult {
    format: number;       // MIDI format type (0 or 1)
    ticksPerBeat: number; // Time division
    tempo: number;        // BPM (from tempo meta event, default 120)
    channels: Map<number, MidiChannel>;
    allNotes: MidiNote[]; // All notes flattened
}

export class MidiImportError extends Error {
    constructor(
        message: string,
        public code: 'INVALID_FORMAT' | 'PARSE_ERROR' | 'UNSUPPORTED_FEATURE' | 'EMPTY_FILE',
        public details?: string
    ) {
        super(message);
        this.name = 'MidiImportError';
    }
}

/**
 * Read a variable-length quantity from MIDI data.
 */
function readVLQ(data: DataView, offset: number): { value: number; bytesRead: number } {
    let value = 0;
    let bytesRead = 0;
    let byte: number;

    do {
        if (offset + bytesRead >= data.byteLength) {
            throw new MidiImportError('Unexpected end of file reading VLQ', 'PARSE_ERROR');
        }
        byte = data.getUint8(offset + bytesRead);
        value = (value << 7) | (byte & 0x7F);
        bytesRead++;
    } while (byte & 0x80);

    return { value, bytesRead };
}

/**
 * Parse MIDI file header chunk.
 */
function parseHeader(data: DataView): { format: number; numTracks: number; ticksPerBeat: number; headerSize: number } {
    // Check for "MThd" magic number
    const magic = String.fromCharCode(
        data.getUint8(0), data.getUint8(1), data.getUint8(2), data.getUint8(3)
    );

    if (magic !== 'MThd') {
        throw new MidiImportError('Invalid MIDI file: missing MThd header', 'INVALID_FORMAT');
    }

    const headerLength = data.getUint32(4);
    const format = data.getUint16(8);
    const numTracks = data.getUint16(10);
    const timeDivision = data.getUint16(12);

    // Check if time division is SMPTE (negative) - we don't support that
    if (timeDivision & 0x8000) {
        throw new MidiImportError('SMPTE time division not supported', 'UNSUPPORTED_FEATURE');
    }

    return {
        format,
        numTracks,
        ticksPerBeat: timeDivision,
        headerSize: 8 + headerLength,
    };
}

/**
 * Parse a single MIDI track.
 */
function parseTrack(
    data: DataView,
    offset: number,
    ticksPerBeat: number
): { notes: MidiNote[]; programs: Map<number, number>; tempo: number; trackSize: number } {
    // Check for "MTrk" magic number
    const magic = String.fromCharCode(
        data.getUint8(offset), data.getUint8(offset + 1),
        data.getUint8(offset + 2), data.getUint8(offset + 3)
    );

    if (magic !== 'MTrk') {
        throw new MidiImportError('Invalid track: missing MTrk header', 'PARSE_ERROR');
    }

    const trackLength = data.getUint32(offset + 4);
    const trackEnd = offset + 8 + trackLength;
    let pos = offset + 8;

    const notes: MidiNote[] = [];
    const activeNotes: Map<string, { pitch: number; startTick: number; velocity: number; channel: number }> = new Map();
    const programs: Map<number, number> = new Map();
    let tempo = 120; // Default tempo
    let currentTick = 0;
    let runningStatus = 0;

    while (pos < trackEnd) {
        // Read delta time
        const { value: deltaTime, bytesRead } = readVLQ(data, pos);
        pos += bytesRead;
        currentTick += deltaTime;

        if (pos >= trackEnd) break;

        // Read event
        let eventByte = data.getUint8(pos);

        // Handle running status
        if (eventByte < 0x80) {
            eventByte = runningStatus;
        } else {
            pos++;
            if (eventByte < 0xF0) {
                runningStatus = eventByte;
            }
        }

        const eventType = eventByte & 0xF0;
        const channel = eventByte & 0x0F;

        switch (eventType) {
            case 0x90: { // Note On
                const pitch = data.getUint8(pos++);
                const velocity = data.getUint8(pos++);

                if (velocity === 0) {
                    // Note On with velocity 0 is Note Off
                    const key = `${channel}-${pitch}`;
                    const active = activeNotes.get(key);
                    if (active) {
                        notes.push({
                            pitch: active.pitch,
                            startTick: active.startTick,
                            durationTicks: currentTick - active.startTick,
                            velocity: active.velocity,
                            channel: active.channel,
                        });
                        activeNotes.delete(key);
                    }
                } else {
                    const key = `${channel}-${pitch}`;
                    activeNotes.set(key, { pitch, startTick: currentTick, velocity, channel });
                }
                break;
            }

            case 0x80: { // Note Off
                const pitch = data.getUint8(pos++);
                pos++; // Skip velocity

                const key = `${channel}-${pitch}`;
                const active = activeNotes.get(key);
                if (active) {
                    notes.push({
                        pitch: active.pitch,
                        startTick: active.startTick,
                        durationTicks: currentTick - active.startTick,
                        velocity: active.velocity,
                        channel: active.channel,
                    });
                    activeNotes.delete(key);
                }
                break;
            }

            case 0xC0: { // Program Change
                const program = data.getUint8(pos++);
                programs.set(channel, program);
                break;
            }

            case 0xB0: // Control Change
            case 0xA0: // Polyphonic Aftertouch
            case 0xE0: // Pitch Bend
                pos += 2;
                break;

            case 0xD0: // Channel Aftertouch
                pos++;
                break;

            case 0xF0: { // System / Meta events
                if (eventByte === 0xFF) {
                    // Meta event
                    const metaType = data.getUint8(pos++);
                    const { value: metaLength, bytesRead: metaLenBytes } = readVLQ(data, pos);
                    pos += metaLenBytes;

                    if (metaType === 0x51 && metaLength === 3) {
                        // Tempo change (microseconds per beat)
                        const microsecondsPerBeat =
                            (data.getUint8(pos) << 16) |
                            (data.getUint8(pos + 1) << 8) |
                            data.getUint8(pos + 2);
                        tempo = Math.round(60000000 / microsecondsPerBeat);
                    }

                    pos += metaLength;
                } else if (eventByte === 0xF0 || eventByte === 0xF7) {
                    // SysEx
                    const { value: sysexLength, bytesRead: sysexLenBytes } = readVLQ(data, pos);
                    pos += sysexLenBytes + sysexLength;
                }
                break;
            }

            default:
                // Skip unknown events
                break;
        }
    }

    // Close any remaining active notes
    for (const [, active] of activeNotes) {
        notes.push({
            pitch: active.pitch,
            startTick: active.startTick,
            durationTicks: currentTick - active.startTick,
            velocity: active.velocity,
            channel: active.channel,
        });
    }

    return {
        notes,
        programs,
        tempo,
        trackSize: 8 + trackLength,
    };
}

/**
 * Parse a complete MIDI file.
 */
export function parseMidiFile(data: ArrayBuffer): MidiParseResult {
    if (data.byteLength < 14) {
        throw new MidiImportError('File too small to be a valid MIDI file', 'INVALID_FORMAT');
    }

    const view = new DataView(data);
    const header = parseHeader(view);

    const channels: Map<number, MidiChannel> = new Map();
    const allNotes: MidiNote[] = [];
    let globalTempo = 120;
    let offset = header.headerSize;

    // Parse all tracks
    for (let i = 0; i < header.numTracks; i++) {
        if (offset >= view.byteLength) break;

        const { notes, programs, tempo, trackSize } = parseTrack(view, offset, header.ticksPerBeat);

        // Use first non-default tempo found
        if (tempo !== 120 && globalTempo === 120) {
            globalTempo = tempo;
        }

        // Add notes to channels
        for (const note of notes) {
            allNotes.push(note);

            if (!channels.has(note.channel)) {
                channels.set(note.channel, {
                    program: programs.get(note.channel) ?? 0,
                    notes: [],
                });
            }
            channels.get(note.channel)!.notes.push(note);
        }

        // Update program info
        for (const [ch, program] of programs) {
            if (channels.has(ch)) {
                channels.get(ch)!.program = program;
            }
        }

        offset += trackSize;
    }

    if (allNotes.length === 0) {
        throw new MidiImportError('MIDI file contains no notes', 'EMPTY_FILE');
    }

    return {
        format: header.format,
        ticksPerBeat: header.ticksPerBeat,
        tempo: globalTempo,
        channels,
        allNotes,
    };
}

/**
 * Convert MIDI note number to pitch string (e.g., 60 -> "C4").
 */
function midiNoteToPitch(midiNote: number): string {
    const octave = Math.floor(midiNote / 12) - 1;
    const noteIndex = midiNote % 12;
    return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * Get the pitch class (0-11) from a MIDI note.
 */
function getPitchClass(midiNote: number): number {
    return midiNote % 12;
}

/**
 * Infer the best matching pentatonic scale from MIDI notes.
 */
export function inferScale(notes: MidiNote[]): { mode: PentatonicMode; root: string; scale: string[] } {
    // Build pitch class histogram weighted by note duration and count
    const histogram: number[] = new Array(12).fill(0);

    for (const note of notes) {
        const pitchClass = getPitchClass(note.pitch);
        histogram[pitchClass] += note.durationTicks * (note.velocity / 127);
    }

    // Find best matching mode and root
    let bestScore = -1;
    let bestMode: PentatonicMode = 'gong';
    let bestRoot = 0;

    for (const [modeName, intervals] of Object.entries(PENTATONIC_MODES)) {
        for (let root = 0; root < 12; root++) {
            let score = 0;
            for (const interval of intervals) {
                const pitchClass = (root + interval) % 12;
                score += histogram[pitchClass];
            }

            if (score > bestScore) {
                bestScore = score;
                bestMode = modeName as PentatonicMode;
                bestRoot = root;
            }
        }
    }

    // Generate scale array
    const scale = PENTATONIC_MODES[bestMode].map(interval => {
        const pitchClass = (bestRoot + interval) % 12;
        return `${NOTE_NAMES[pitchClass]}4`; // Use octave 4 as reference
    });

    return {
        mode: bestMode,
        root: NOTE_NAMES[bestRoot],
        scale,
    };
}

/**
 * Extract a motif from the MIDI notes.
 * Takes the first few notes that form a coherent melodic phrase.
 */
export function extractMotif(notes: MidiNote[], ticksPerBeat: number): Motif {
    // Sort notes by start time
    const sortedNotes = [...notes].sort((a, b) => a.startTick - b.startTick);

    // Take the first 4-8 notes as the motif
    const motifLength = Math.min(Math.max(4, Math.floor(notes.length / 4)), 8);
    const motifNotes = sortedNotes.slice(0, motifLength);

    const pitches = motifNotes.map(note => midiNoteToPitch(note.pitch));
    const rhythm = motifNotes.map(note => note.durationTicks / ticksPerBeat);

    return { pitches, rhythm };
}

/**
 * Infer musical form from note density patterns.
 */
export function inferForm(notes: MidiNote[], ticksPerBeat: number): string[] {
    if (notes.length < 8) {
        return ['A'];
    }

    // Sort notes by start time
    const sortedNotes = [...notes].sort((a, b) => a.startTick - b.startTick);
    const totalDuration = sortedNotes[sortedNotes.length - 1].startTick +
        sortedNotes[sortedNotes.length - 1].durationTicks;

    // Divide into sections (approximately 8 beats each)
    const sectionDuration = ticksPerBeat * 8;
    const numSections = Math.max(2, Math.min(8, Math.ceil(totalDuration / sectionDuration)));
    const actualSectionDuration = totalDuration / numSections;

    // Calculate average pitch for each section
    const sectionPitches: number[] = [];
    for (let i = 0; i < numSections; i++) {
        const sectionStart = i * actualSectionDuration;
        const sectionEnd = (i + 1) * actualSectionDuration;
        const sectionNotes = sortedNotes.filter(n =>
            n.startTick >= sectionStart && n.startTick < sectionEnd
        );

        if (sectionNotes.length > 0) {
            const avgPitch = sectionNotes.reduce((sum, n) => sum + n.pitch, 0) / sectionNotes.length;
            sectionPitches.push(avgPitch);
        } else {
            sectionPitches.push(sectionPitches.length > 0 ? sectionPitches[sectionPitches.length - 1] : 60);
        }
    }

    // Assign form labels based on similarity to first section
    const form: string[] = [];
    const threshold = 3; // Semitones difference threshold

    for (let i = 0; i < numSections; i++) {
        const diff = Math.abs(sectionPitches[i] - sectionPitches[0]);

        if (diff < threshold) {
            // Similar to A section
            if (i === 0) {
                form.push('A');
            } else if (i === numSections - 1) {
                form.push("A''");
            } else {
                form.push("A'");
            }
        } else {
            // Different - B section
            form.push('B');
        }
    }

    // Simplify form to max 5 sections
    if (form.length > 5) {
        const simplified = [form[0]];
        const step = (form.length - 1) / 3;
        simplified.push(form[Math.floor(step)]);
        simplified.push(form[Math.floor(step * 2)]);
        simplified.push(form[form.length - 1]);
        return simplified;
    }

    return form;
}

/**
 * Generate Euclidean-style rhythm pattern from notes.
 */
export function generateEuclideanPattern(notes: MidiNote[], ticksPerBeat: number, patternLength: number = 8): number[] {
    if (notes.length === 0) {
        return [1, 0, 1, 0, 1, 0, 1, 0];
    }

    // Get one beat's worth of time
    const beatDuration = ticksPerBeat;
    const subdivision = beatDuration / patternLength;

    // Find notes in the first few beats
    const sortedNotes = [...notes].sort((a, b) => a.startTick - b.startTick);
    const sampleDuration = beatDuration * 2; // Sample 2 beats

    const pattern: number[] = new Array(patternLength).fill(0);

    for (const note of sortedNotes) {
        if (note.startTick >= sampleDuration) break;

        const position = Math.floor((note.startTick % beatDuration) / subdivision) % patternLength;
        pattern[position] = 1;
    }

    // Ensure at least some hits
    const hits = pattern.reduce((sum, v) => sum + v, 0);
    if (hits === 0) {
        pattern[0] = 1;
        pattern[Math.floor(patternLength / 2)] = 1;
    }

    return pattern;
}

/**
 * Map MIDI program number to our instrument set.
 */
export function mapProgramToInstrument(program: number): Instrument {
    return PROGRAM_TO_INSTRUMENT[program] ?? 'erhu';
}

/**
 * Infer mood from MIDI characteristics.
 */
function inferMood(notes: MidiNote[], tempo: number): Mood {
    if (notes.length === 0) return 'calm';

    // Calculate average velocity
    const avgVelocity = notes.reduce((sum, n) => sum + n.velocity, 0) / notes.length;

    // Calculate pitch variance
    const pitches = notes.map(n => n.pitch);
    const avgPitch = pitches.reduce((sum, p) => sum + p, 0) / pitches.length;
    const variance = pitches.reduce((sum, p) => sum + Math.pow(p - avgPitch, 2), 0) / pitches.length;

    // Fast tempo + high velocity = festive or heroic
    if (tempo > 100 && avgVelocity > 80) {
        return variance > 50 ? 'heroic' : 'festive';
    }

    // Slow tempo + low velocity = calm or melancholic
    if (tempo < 70) {
        return avgVelocity < 60 ? 'melancholic' : 'calm';
    }

    // Medium tempo
    return avgVelocity > 70 ? 'festive' : 'calm';
}

/**
 * Convert parsed MIDI data to Composition and CompositionParams.
 */
export function midiToComposition(parsed: MidiParseResult): {
    composition: Composition;
    params: CompositionParams;
} {
    const { mode, root, scale } = inferScale(parsed.allNotes);
    const motif = extractMotif(parsed.allNotes, parsed.ticksPerBeat);
    const form = inferForm(parsed.allNotes, parsed.ticksPerBeat);
    const mood = inferMood(parsed.allNotes, parsed.tempo);

    // Determine instruments from channels
    const instruments: Instrument[] = [];
    const instrumentRoles: Record<string, string> = {};
    const euclideanPatterns: Record<string, number[]> = {};

    // Get unique instruments from channels
    const channelList = Array.from(parsed.channels.entries())
        .sort((a, b) => b[1].notes.length - a[1].notes.length); // Sort by note count

    for (const [, channel] of channelList) {
        const instrument = mapProgramToInstrument(channel.program);
        if (!instruments.includes(instrument) && instruments.length < 4) {
            instruments.push(instrument);

            // Assign role based on order (first = melody, etc.)
            let role: string;
            if (instruments.length === 1) {
                role = 'melody';
            } else if (instruments.length === 2) {
                role = 'accompaniment';
            } else {
                role = 'bass';
            }

            instrumentRoles[instrument] = role;
            euclideanPatterns[role] = generateEuclideanPattern(channel.notes, parsed.ticksPerBeat);
        }
    }

    // Ensure at least one instrument
    if (instruments.length === 0) {
        instruments.push('erhu');
        instrumentRoles['erhu'] = 'melody';
        euclideanPatterns['melody'] = [1, 0, 1, 0, 1, 0, 1, 0];
    }

    // Clamp tempo to valid range
    const tempo = Math.max(40, Math.min(160, parsed.tempo));

    const composition: Composition = {
        scale,
        motif,
        form,
        instrumentRoles,
        euclideanPatterns,
    };

    const params: CompositionParams = {
        mode,
        root,
        tempo,
        instruments,
        mood,
    };

    return { composition, params };
}
