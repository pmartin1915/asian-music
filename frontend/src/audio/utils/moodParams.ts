/**
 * Mood-specific synthesis parameters.
 * Maps moods to voice parameter adjustments.
 */

import type { Mood, Instrument } from '../../types/music';
import type { VoiceParameters, ADSREnvelope } from '../types';

/**
 * Base parameters for each instrument.
 */
export const INSTRUMENT_BASE_PARAMS: Record<Instrument, VoiceParameters> = {
    erhu: {
        filterCutoff: 3000,
        filterResonance: 2,
        envelope: {
            attack: 0.08,
            decay: 0.1,
            sustain: 0.8,
            release: 0.2,
        },
        vibratoRate: 5.5,
        vibratoDepth: 25,
        portamentoTime: 0.15,
    },
    guzheng: {
        filterCutoff: 6000,
        filterResonance: 1.5,
        envelope: {
            attack: 0.005,
            decay: 1.5,
            sustain: 0.0,
            release: 0.3,
        },
        decayTime: 2.0,
        brightness: 0.6,
    },
    pipa: {
        filterCutoff: 4000,
        filterResonance: 2,
        envelope: {
            attack: 0.003,
            decay: 0.5,
            sustain: 0.0,
            release: 0.15,
        },
        decayTime: 0.6,
        brightness: 0.7,
        tremoloRate: 12,
        tremoloDepth: 0.4,
    },
    dizi: {
        filterCutoff: 5000,
        filterResonance: 1,
        envelope: {
            attack: 0.04,
            decay: 0.1,
            sustain: 0.75,
            release: 0.15,
        },
        vibratoRate: 4.5,
        vibratoDepth: 20,
        breathiness: 0.2,
        membraneBuzz: 0.15,
    },
};

/**
 * Mood modifiers applied on top of base parameters.
 */
export const MOOD_MODIFIERS: Record<Mood, Partial<VoiceParameters>> = {
    calm: {
        filterCutoff: 2500,
        filterResonance: 1.5,
        envelope: {
            attack: 0.12,
            decay: 0.15,
            sustain: 0.7,
            release: 0.3,
        },
        vibratoRate: 4,
        vibratoDepth: 15,
        brightness: 0.4,
        breathiness: 0.15,
    },
    heroic: {
        filterCutoff: 4500,
        filterResonance: 3,
        envelope: {
            attack: 0.03,
            decay: 0.08,
            sustain: 0.85,
            release: 0.15,
        },
        vibratoRate: 6,
        vibratoDepth: 35,
        brightness: 0.85,
        breathiness: 0.25,
        tremoloDepth: 0.5,
    },
    melancholic: {
        filterCutoff: 2000,
        filterResonance: 2.5,
        envelope: {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.65,
            release: 0.4,
        },
        vibratoRate: 5,
        vibratoDepth: 30,
        brightness: 0.3,
        breathiness: 0.2,
        portamentoTime: 0.2,
    },
    festive: {
        filterCutoff: 5500,
        filterResonance: 2,
        envelope: {
            attack: 0.02,
            decay: 0.05,
            sustain: 0.9,
            release: 0.1,
        },
        vibratoRate: 7,
        vibratoDepth: 40,
        brightness: 0.95,
        breathiness: 0.3,
        tremoloRate: 14,
        tremoloDepth: 0.6,
    },
};

/**
 * Get synthesizer parameters for an instrument and mood.
 *
 * @param instrument - The instrument type
 * @param mood - The mood setting
 * @returns Combined voice parameters
 */
export function getVoiceParams(instrument: Instrument, mood: Mood): VoiceParameters {
    const base = INSTRUMENT_BASE_PARAMS[instrument];
    const moodMod = MOOD_MODIFIERS[mood];

    // Merge base params with mood modifiers
    const result: VoiceParameters = {
        ...base,
        ...moodMod,
        // Merge envelope separately to preserve all fields
        envelope: mergeEnvelope(base.envelope, moodMod.envelope),
    };

    return result;
}

/**
 * Merge two envelopes, preferring values from the override.
 */
function mergeEnvelope(
    base: ADSREnvelope,
    override?: Partial<ADSREnvelope>
): ADSREnvelope {
    if (!override) return base;
    return {
        attack: override.attack ?? base.attack,
        decay: override.decay ?? base.decay,
        sustain: override.sustain ?? base.sustain,
        release: override.release ?? base.release,
    };
}

/**
 * Velocity scaling based on instrument role.
 */
export const ROLE_VELOCITY: Record<string, number> = {
    melody: 0.85,
    countermelody: 0.7,
    accompaniment: 0.55,
    bass: 0.75,
};

/**
 * Octave offset for instrument roles (relative to scale).
 */
export const ROLE_OCTAVE_OFFSET: Record<string, number> = {
    melody: 0,
    countermelody: 0,
    accompaniment: 0,
    bass: -1,
};

/**
 * Get tempo-scaled attack time.
 * Faster tempos get shorter attacks.
 */
export function getTempoScaledAttack(baseAttack: number, tempo: number): number {
    const tempoFactor = 100 / tempo; // 100 BPM is reference
    return Math.min(baseAttack * tempoFactor, baseAttack * 1.5);
}

/**
 * Calculate note duration from rhythm value and tempo.
 *
 * @param rhythmValue - Relative duration (1.0 = quarter note)
 * @param tempo - Beats per minute
 * @returns Duration in seconds
 */
export function rhythmToDuration(rhythmValue: number, tempo: number): number {
    const beatDuration = 60 / tempo; // Duration of one beat in seconds
    return rhythmValue * beatDuration;
}

/**
 * Get pan position for an instrument (-1 to 1).
 */
export const INSTRUMENT_PAN: Record<Instrument, number> = {
    erhu: -0.3,      // Slightly left
    guzheng: 0.3,    // Slightly right
    pipa: -0.2,      // Center-left
    dizi: 0.2,       // Center-right
};

/**
 * Master gain for each instrument to balance the mix.
 */
export const INSTRUMENT_GAIN: Record<Instrument, number> = {
    erhu: 0.8,
    guzheng: 0.7,
    pipa: 0.75,
    dizi: 0.65,
};
