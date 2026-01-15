/**
 * Schedules notes on the Web Audio graph for playback.
 */

import type { ScheduledNote, InstrumentTrack } from '../types';
import type { Instrument } from '../../types/music';

/**
 * Context for scheduling notes on the audio graph.
 */
export interface SchedulingContext {
    /** The audio context (online or offline) */
    audioContext: BaseAudioContext;
    /** Destination node for each instrument */
    destinations: Map<Instrument, AudioNode>;
    /** Time offset for scheduling (for seek support) */
    timeOffset: number;
}

/**
 * Callback type for scheduling a single note.
 */
export type NoteScheduleCallback = (
    note: ScheduledNote,
    destination: AudioNode,
    audioContext: BaseAudioContext
) => void;

/**
 * Schedule all notes in a track.
 *
 * @param track - The instrument track containing notes
 * @param context - Scheduling context with audio graph info
 * @param scheduleNote - Callback to schedule individual notes
 */
export function scheduleTrack(
    track: InstrumentTrack,
    context: SchedulingContext,
    scheduleNote: NoteScheduleCallback
): void {
    const destination = context.destinations.get(track.instrument);
    if (!destination) {
        console.warn(`[NoteScheduler] No destination for ${track.instrument}`);
        return;
    }

    for (const note of track.notes) {
        // Adjust start time by offset
        const adjustedNote: ScheduledNote = {
            ...note,
            startTime: note.startTime + context.timeOffset,
        };

        // Skip notes that would start in the past
        if (adjustedNote.startTime < 0) continue;

        scheduleNote(adjustedNote, destination, context.audioContext);
    }
}

/**
 * Schedule all tracks in a composition.
 *
 * @param tracks - Map of instrument tracks
 * @param context - Scheduling context
 * @param scheduleNote - Callback to schedule individual notes
 */
export function scheduleAllTracks(
    tracks: Map<Instrument, InstrumentTrack>,
    context: SchedulingContext,
    scheduleNote: NoteScheduleCallback
): void {
    tracks.forEach((track) => {
        scheduleTrack(track, context, scheduleNote);
    });
}

/**
 * Create a basic note scheduling function for simple oscillator synthesis.
 * This is a reference implementation; instrument voices provide their own.
 */
export function createSimpleScheduler(): NoteScheduleCallback {
    return (note: ScheduledNote, destination: AudioNode, audioContext: BaseAudioContext) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.value = note.frequency;

        // Simple envelope
        gain.gain.setValueAtTime(0, note.startTime);
        gain.gain.linearRampToValueAtTime(note.velocity * 0.3, note.startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, note.startTime + note.duration);

        osc.connect(gain);
        gain.connect(destination);

        osc.start(note.startTime);
        osc.stop(note.startTime + note.duration + 0.1);
    };
}

/**
 * Calculate the number of notes per second (for progress indication).
 */
export function getNotesDensity(track: InstrumentTrack): number {
    if (track.notes.length < 2) return 0;

    const firstNote = track.notes[0];
    const lastNote = track.notes[track.notes.length - 1];
    const duration = lastNote.startTime + lastNote.duration - firstNote.startTime;

    if (duration <= 0) return 0;
    return track.notes.length / duration;
}

/**
 * Get the time range of a track.
 */
export function getTrackTimeRange(track: InstrumentTrack): { start: number; end: number } {
    if (track.notes.length === 0) {
        return { start: 0, end: 0 };
    }

    const start = track.notes[0].startTime;
    const lastNote = track.notes[track.notes.length - 1];
    const end = lastNote.startTime + lastNote.duration;

    return { start, end };
}

/**
 * Filter notes within a time range (for partial playback).
 */
export function filterNotesInRange(
    notes: ScheduledNote[],
    startTime: number,
    endTime: number
): ScheduledNote[] {
    return notes.filter(note => {
        const noteEnd = note.startTime + note.duration;
        return noteEnd > startTime && note.startTime < endTime;
    });
}

/**
 * Quantize note times to a grid (for tighter timing).
 */
export function quantizeNotes(
    notes: ScheduledNote[],
    gridSize: number
): ScheduledNote[] {
    return notes.map(note => ({
        ...note,
        startTime: Math.round(note.startTime / gridSize) * gridSize,
    }));
}

/**
 * Add humanization (slight timing variations) to notes.
 */
export function humanizeNotes(
    notes: ScheduledNote[],
    maxOffset: number = 0.02
): ScheduledNote[] {
    return notes.map(note => ({
        ...note,
        startTime: note.startTime + (Math.random() - 0.5) * maxOffset * 2,
        velocity: note.velocity * (0.95 + Math.random() * 0.1),
    }));
}

/**
 * Sort notes by start time.
 */
export function sortNotesByTime(notes: ScheduledNote[]): ScheduledNote[] {
    return [...notes].sort((a, b) => a.startTime - b.startTime);
}

/**
 * Merge notes from multiple tracks into a single sorted array.
 */
export function mergeTracksNotes(tracks: InstrumentTrack[]): ScheduledNote[] {
    const allNotes: ScheduledNote[] = [];
    for (const track of tracks) {
        allNotes.push(...track.notes);
    }
    return sortNotesByTime(allNotes);
}
