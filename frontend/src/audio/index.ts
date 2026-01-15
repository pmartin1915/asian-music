/**
 * Audio synthesis module for Silk Road Composer.
 *
 * This module provides client-side Web Audio API synthesis
 * as a replacement for the Lyria-002 backend API.
 */

// Main synthesizer
export {
    SynthesizerEngine,
    getSynthesizerEngine,
    synthesizeInstrument,
} from './synthesizer';
export type { RenderProgressCallback } from './synthesizer';

// Types
export type {
    ScheduledNote,
    InstrumentTrack,
    ADSREnvelope,
    VoiceParameters,
    MoodParameters,
    SynthesizerConfig,
    RenderResult,
    InstrumentVoice,
    VoiceFactory,
} from './types';
export {
    NOTE_OFFSETS,
    PENTATONIC_INTERVALS,
    SECTION_DURATION,
    DEFAULT_SAMPLE_RATE,
    NUM_CHANNELS,
} from './types';

// Voices
export { createVoice, VOICE_REGISTRY } from './voices';
export { BaseVoice } from './voices/BaseVoice';
export { ErhuVoice } from './voices/ErhuVoice';
export { GuzhengVoice } from './voices/GuzhengVoice';
export { PipaVoice } from './voices/PipaVoice';
export { DiziVoice } from './voices/DiziVoice';

// Scheduling
export {
    mapCompositionToTracks,
    getCompositionDuration,
    buildScale,
    generateEuclidean,
    repeatPatternTimes,
    scheduleAllTracks,
} from './scheduling';

// Utilities
export {
    noteToFrequency,
    transposeNote,
    audioBufferToBase64WAV,
    getVoiceParams,
    INSTRUMENT_GAIN,
} from './utils';
