/**
 * Audio utilities module exports.
 */

export {
    parseNote,
    noteToMidi,
    midiToFrequency,
    noteToFrequency,
    frequencyToNote,
    midiToNote,
    transposeNote,
    centsToRatio,
    intervalBetween,
    COMMON_FREQUENCIES,
} from './frequencies';

export {
    ENVELOPE_PRESETS,
    applyADSREnvelope,
    applyExponentialEnvelope,
    applyPluckedEnvelope,
    applyFilterEnvelope,
    smoothGainRamp,
    getEnvelopeDuration,
    scaleEnvelope,
} from './envelope';

export {
    audioBufferToWavBlob,
    audioBufferToBase64WAV,
    createSilentBuffer,
    mixBuffers,
} from './wavEncoder';

export {
    INSTRUMENT_BASE_PARAMS,
    MOOD_MODIFIERS,
    getVoiceParams,
    ROLE_VELOCITY,
    ROLE_OCTAVE_OFFSET,
    getTempoScaledAttack,
    rhythmToDuration,
    INSTRUMENT_PAN,
    INSTRUMENT_GAIN,
} from './moodParams';
