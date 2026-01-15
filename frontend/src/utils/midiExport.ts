/**
 * Minimal MIDI Type 0 file encoder for exporting compositions.
 * No external dependencies required.
 */

import type { Composition, Instrument } from '../types/music';

// MIDI note numbers for pitches (C4 = 60)
const NOTE_MAP: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

// General MIDI instruments for Chinese instruments (approximations)
const INSTRUMENT_PROGRAMS: Record<Instrument, number> = {
    erhu: 110,    // Fiddle
    guzheng: 107, // Koto
    pipa: 105,    // Banjo (closest plucked)
    dizi: 73,     // Flute
};

interface MidiNote {
    pitch: number;
    startTick: number;
    durationTicks: number;
    velocity: number;
    channel: number;
}

/**
 * Parse a pitch string like "C4" to MIDI note number.
 */
function parsePitch(pitchStr: string): number {
    const match = pitchStr.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return 60; // Default to C4

    const [, note, octaveStr] = match;
    const octave = parseInt(octaveStr, 10);
    const semitone = NOTE_MAP[note] ?? 0;

    return (octave + 1) * 12 + semitone;
}

/**
 * Write a variable-length quantity (VLQ) for MIDI.
 */
function writeVLQ(value: number): number[] {
    if (value < 0) value = 0;

    const bytes: number[] = [];
    bytes.push(value & 0x7F);
    value >>= 7;

    while (value > 0) {
        bytes.push((value & 0x7F) | 0x80);
        value >>= 7;
    }

    return bytes.reverse();
}

/**
 * Write a 16-bit big-endian value.
 */
function writeUint16BE(value: number): number[] {
    return [(value >> 8) & 0xFF, value & 0xFF];
}

/**
 * Write a 32-bit big-endian value.
 */
function writeUint32BE(value: number): number[] {
    return [
        (value >> 24) & 0xFF,
        (value >> 16) & 0xFF,
        (value >> 8) & 0xFF,
        value & 0xFF,
    ];
}

/**
 * Create MIDI header chunk.
 */
function createHeaderChunk(ticksPerBeat: number): number[] {
    const header = [
        0x4D, 0x54, 0x68, 0x64, // "MThd"
        ...writeUint32BE(6),     // Header length
        ...writeUint16BE(0),     // Format type 0
        ...writeUint16BE(1),     // Number of tracks
        ...writeUint16BE(ticksPerBeat), // Ticks per quarter note
    ];
    return header;
}

/**
 * Create track chunk from MIDI events.
 */
function createTrackChunk(events: number[][]): number[] {
    // Flatten events
    const eventData: number[] = [];
    for (const event of events) {
        eventData.push(...event);
    }

    // Add end of track
    eventData.push(...writeVLQ(0)); // Delta time
    eventData.push(0xFF, 0x2F, 0x00); // End of track meta event

    const track = [
        0x4D, 0x54, 0x72, 0x6B, // "MTrk"
        ...writeUint32BE(eventData.length),
        ...eventData,
    ];
    return track;
}

/**
 * Create tempo meta event.
 */
function createTempoEvent(bpm: number): number[] {
    const microsecondsPerBeat = Math.round(60000000 / bpm);
    return [
        ...writeVLQ(0), // Delta time
        0xFF, 0x51, 0x03, // Tempo meta event
        (microsecondsPerBeat >> 16) & 0xFF,
        (microsecondsPerBeat >> 8) & 0xFF,
        microsecondsPerBeat & 0xFF,
    ];
}

/**
 * Create program change event.
 */
function createProgramChange(channel: number, program: number): number[] {
    return [
        ...writeVLQ(0), // Delta time
        0xC0 | (channel & 0x0F),
        program & 0x7F,
    ];
}

/**
 * Create note on event.
 */
function createNoteOn(deltaTicks: number, channel: number, pitch: number, velocity: number): number[] {
    return [
        ...writeVLQ(deltaTicks),
        0x90 | (channel & 0x0F),
        pitch & 0x7F,
        velocity & 0x7F,
    ];
}

/**
 * Create note off event.
 */
function createNoteOff(deltaTicks: number, channel: number, pitch: number): number[] {
    return [
        ...writeVLQ(deltaTicks),
        0x80 | (channel & 0x0F),
        pitch & 0x7F,
        0x40, // Release velocity
    ];
}

/**
 * Generate notes from composition.
 */
function generateNotesFromComposition(
    composition: Composition,
    tempo: number,
    ticksPerBeat: number
): MidiNote[] {
    const notes: MidiNote[] = [];
    const instruments = Object.keys(composition.instrumentRoles) as Instrument[];

    // Calculate ticks per beat
    const secondsPerBeat = 60 / tempo;

    let currentTick = 0;

    // Generate notes for each section in form
    for (const section of composition.form) {
        // For each instrument
        instruments.forEach((instrument, channelIndex) => {
            const role = composition.instrumentRoles[instrument];
            const pattern = composition.euclideanPatterns[role] || [1, 0, 1, 0, 1, 0, 1, 0];

            // Generate notes based on motif and pattern
            const { pitches, rhythm } = composition.motif;

            let sectionTick = currentTick;
            let pitchIndex = 0;

            for (let i = 0; i < pattern.length; i++) {
                if (pattern[i] === 1) {
                    const pitch = parsePitch(pitches[pitchIndex % pitches.length]);
                    const duration = rhythm[pitchIndex % rhythm.length];
                    const durationTicks = Math.round(duration * ticksPerBeat);

                    // Vary pitch for different sections
                    let adjustedPitch = pitch;
                    if (section.includes("'")) adjustedPitch += 2; // Transpose up slightly
                    if (section === 'B') adjustedPitch += 5; // Transpose up for B section

                    notes.push({
                        pitch: Math.min(127, Math.max(0, adjustedPitch)),
                        startTick: sectionTick,
                        durationTicks,
                        velocity: role === 'melody' ? 100 : 70,
                        channel: channelIndex,
                    });

                    pitchIndex++;
                }

                // Move to next beat position
                sectionTick += Math.round(ticksPerBeat * (secondsPerBeat / (pattern.length / 8)));
            }
        });

        // Move to next section (8 beats per section)
        currentTick += ticksPerBeat * 8;
    }

    return notes;
}

/**
 * Export composition to MIDI file.
 */
export function compositionToMidi(
    composition: Composition,
    tempo: number = 72
): Uint8Array {
    const ticksPerBeat = 480; // Standard resolution
    const instruments = Object.keys(composition.instrumentRoles) as Instrument[];

    // Generate notes
    const notes = generateNotesFromComposition(composition, tempo, ticksPerBeat);

    // Sort notes by start time
    notes.sort((a, b) => a.startTick - b.startTick);

    // Create MIDI events
    const events: number[][] = [];

    // Add tempo event
    events.push(createTempoEvent(tempo));

    // Add program changes for each instrument
    instruments.forEach((instrument, channel) => {
        const program = INSTRUMENT_PROGRAMS[instrument] || 0;
        events.push(createProgramChange(channel, program));
    });

    // Create note events with proper delta times
    interface NoteEvent {
        tick: number;
        type: 'on' | 'off';
        channel: number;
        pitch: number;
        velocity: number;
    }

    const noteEvents: NoteEvent[] = [];

    for (const note of notes) {
        noteEvents.push({
            tick: note.startTick,
            type: 'on',
            channel: note.channel,
            pitch: note.pitch,
            velocity: note.velocity,
        });
        noteEvents.push({
            tick: note.startTick + note.durationTicks,
            type: 'off',
            channel: note.channel,
            pitch: note.pitch,
            velocity: 0,
        });
    }

    // Sort all note events by tick
    noteEvents.sort((a, b) => a.tick - b.tick);

    // Convert to MIDI events with delta times
    let lastTick = 0;
    for (const event of noteEvents) {
        const deltaTick = event.tick - lastTick;
        lastTick = event.tick;

        if (event.type === 'on') {
            events.push(createNoteOn(deltaTick, event.channel, event.pitch, event.velocity));
        } else {
            events.push(createNoteOff(deltaTick, event.channel, event.pitch));
        }
    }

    // Assemble MIDI file
    const midiData = [
        ...createHeaderChunk(ticksPerBeat),
        ...createTrackChunk(events),
    ];

    return new Uint8Array(midiData);
}

/**
 * Download MIDI file.
 */
export function downloadMidi(composition: Composition, tempo: number, filename: string = 'composition.mid'): void {
    const midiData = compositionToMidi(composition, tempo);
    const blob = new Blob([midiData], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}
