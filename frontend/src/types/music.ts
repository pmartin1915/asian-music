// Shared type definitions for Silk Road Composer

// Valid parameter value types
export type PentatonicMode = 'gong' | 'shang' | 'jue' | 'zhi' | 'yu';
export type Instrument = 'erhu' | 'guzheng' | 'pipa' | 'dizi';
export type Mood = 'calm' | 'heroic' | 'melancholic' | 'festive';

// Parameters sent to the compose function
export interface CompositionParams {
    mode: PentatonicMode;
    root: string;
    tempo: number;
    instruments: Instrument[];
    mood: Mood;
    seed?: number;
}

// Motif structure within a composition
export interface Motif {
    pitches: string[];
    rhythm: number[];
}

// Composition structure returned from the compose function
export interface Composition {
    scale: string[];
    motif: Motif;
    form: string[];
    instrumentRoles: Record<string, string>;
    euclideanPatterns: Record<string, number[]>;
}

// Audio generation result
export interface AudioResult {
    audioContent: string;
    mimeType: string;
    seed: number;
}

// Audio result with instrument identifier (for multi-instrument support)
export interface InstrumentAudioResult extends AudioResult {
    instrument: Instrument;
}

// Job status for async generation
export type JobStatus =
    | 'pending'
    | 'composing'
    | 'synthesizing'
    | 'complete'
    | 'error';

// Progress update for a generation job
export interface JobProgress {
    jobId: string;
    status: JobStatus;
    currentStep: string;
    progress: number; // 0-100
    composition?: Composition;
    audioResults?: InstrumentAudioResult[];
    error?: string;
}

// Job submission response
export interface JobSubmission {
    jobId: string;
    status: 'accepted';
}
