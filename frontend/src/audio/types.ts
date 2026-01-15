/**
 * Type definitions for the Web Audio synthesizer module.
 */

import type { Instrument, Mood, PentatonicMode } from '../types/music';

/**
 * A scheduled note event for synthesis.
 */
export interface ScheduledNote {
    /** Note name (e.g., "C4", "D4") */
    pitch: string;
    /** Frequency in Hz */
    frequency: number;
    /** Start time in seconds from composition start */
    startTime: number;
    /** Duration in seconds */
    duration: number;
    /** Velocity/intensity 0-1 */
    velocity: number;
    /** Which instrument plays this note */
    instrument: Instrument;
}

/**
 * A track containing all notes for one instrument.
 */
export interface InstrumentTrack {
    instrument: Instrument;
    role: string;
    notes: ScheduledNote[];
}

/**
 * ADSR envelope parameters.
 */
export interface ADSREnvelope {
    /** Attack time in seconds */
    attack: number;
    /** Decay time in seconds */
    decay: number;
    /** Sustain level 0-1 */
    sustain: number;
    /** Release time in seconds */
    release: number;
}

/**
 * Voice parameters that control instrument timbre.
 */
export interface VoiceParameters {
    // Filter
    filterCutoff: number;       // Hz
    filterResonance: number;    // Q factor

    // Envelope
    envelope: ADSREnvelope;

    // Bowed instruments (Erhu)
    vibratoRate?: number;       // Hz
    vibratoDepth?: number;      // cents
    portamentoTime?: number;    // seconds

    // Plucked instruments (Guzheng, Pipa)
    decayTime?: number;         // seconds
    brightness?: number;        // 0-1

    // Breath instruments (Dizi)
    breathiness?: number;       // 0-1
    membraneBuzz?: number;      // 0-1

    // Tremolo (Pipa)
    tremoloRate?: number;       // Hz
    tremoloDepth?: number;      // 0-1

    // FM synthesis
    fmDepth?: number;           // Hz (modulation depth)

    // Reverb
    reverbSend?: number;        // 0-1 (reverb mix)
}

/**
 * Mood-specific parameter overrides.
 */
export type MoodParameters = Record<Mood, Partial<VoiceParameters>>;

/**
 * Configuration for the synthesizer engine.
 */
export interface SynthesizerConfig {
    /** Sample rate for offline rendering */
    sampleRate: number;
    /** Total composition duration in seconds */
    duration: number;
    /** Tempo in BPM */
    tempo: number;
    /** Current mood */
    mood: Mood;
    /** Pentatonic mode */
    mode: PentatonicMode;
    /** Root note (e.g., "C", "D") */
    root: string;
}

/**
 * Result of rendering a single instrument track.
 */
export interface RenderResult {
    /** The rendered audio buffer */
    buffer: AudioBuffer;
    /** Duration in seconds */
    duration: number;
    /** Instrument that was rendered */
    instrument: Instrument;
}

/**
 * Interface that all instrument voices must implement.
 */
export interface InstrumentVoice {
    /** The instrument type */
    readonly instrument: Instrument;

    /** Connect the voice output to a destination node */
    connect(destination: AudioNode): void;

    /** Disconnect from all destinations */
    disconnect(): void;

    /** Schedule a note to play */
    scheduleNote(note: ScheduledNote, destination: AudioNode): void;

    /** Set a voice parameter */
    setParameter(name: keyof VoiceParameters, value: number): void;

    /** Get current parameters */
    getParameters(): VoiceParameters;

    /** Dispose of all resources */
    dispose(): void;
}

/**
 * Factory function type for creating instrument voices.
 */
export type VoiceFactory = (
    context: BaseAudioContext,
    params: VoiceParameters
) => InstrumentVoice;

/**
 * Map of note names to their semitone offset from C0.
 */
export const NOTE_OFFSETS: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4, 'E#': 5,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11, 'B#': 0,
};

/**
 * Pentatonic scale intervals (semitones from root).
 * Each mode starts from a different degree of the major pentatonic.
 */
export const PENTATONIC_INTERVALS: Record<PentatonicMode, number[]> = {
    gong: [0, 2, 4, 7, 9],       // Major pentatonic (1, 2, 3, 5, 6)
    shang: [0, 2, 5, 7, 10],     // Starting from 2nd degree
    jue: [0, 3, 5, 8, 10],       // Starting from 3rd degree
    zhi: [0, 2, 5, 7, 9],        // Starting from 5th degree
    yu: [0, 3, 5, 7, 10],        // Minor pentatonic (1, b3, 4, 5, b7)
};

/**
 * Default section duration in seconds.
 */
export const SECTION_DURATION = 15;

/**
 * Default sample rate for offline rendering.
 */
export const DEFAULT_SAMPLE_RATE = 44100;

/**
 * Number of audio channels (stereo).
 */
export const NUM_CHANNELS = 2;
