/**
 * ADSR envelope utilities for Web Audio API synthesis.
 */

import type { ADSREnvelope } from '../types';

/**
 * Default envelope presets for different articulations.
 */
export const ENVELOPE_PRESETS: Record<string, ADSREnvelope> = {
    // Smooth, sustained sound (erhu, dizi)
    sustained: {
        attack: 0.08,
        decay: 0.1,
        sustain: 0.8,
        release: 0.2,
    },
    // Quick plucked sound (guzheng, pipa)
    plucked: {
        attack: 0.005,
        decay: 0.3,
        sustain: 0.0,
        release: 0.3,
    },
    // Very percussive (pipa bass)
    percussive: {
        attack: 0.002,
        decay: 0.15,
        sustain: 0.0,
        release: 0.1,
    },
    // Soft breath attack (dizi)
    breath: {
        attack: 0.05,
        decay: 0.1,
        sustain: 0.7,
        release: 0.15,
    },
    // Slow pad-like (ambient, calm mood)
    pad: {
        attack: 0.3,
        decay: 0.5,
        sustain: 0.6,
        release: 0.5,
    },
};

/**
 * Apply an ADSR envelope to a GainNode.
 *
 * @param gainNode - The GainNode to apply the envelope to
 * @param envelope - ADSR envelope parameters
 * @param startTime - When to start the envelope (AudioContext time)
 * @param duration - Note duration in seconds
 * @param velocity - Note velocity 0-1
 */
export function applyADSREnvelope(
    gainNode: GainNode,
    envelope: ADSREnvelope,
    startTime: number,
    duration: number,
    velocity: number = 1.0
): void {
    const { attack, decay, sustain, release } = envelope;
    const gain = gainNode.gain;
    const maxGain = velocity;

    // Cancel any previous automation
    gain.cancelScheduledValues(startTime);

    // Start at zero
    gain.setValueAtTime(0, startTime);

    // Attack phase: ramp up to max
    gain.linearRampToValueAtTime(maxGain, startTime + attack);

    // Decay phase: ramp down to sustain level
    const sustainGain = maxGain * sustain;
    gain.linearRampToValueAtTime(sustainGain, startTime + attack + decay);

    // Sustain phase: hold at sustain level until note end
    const noteEndTime = startTime + duration;
    gain.setValueAtTime(sustainGain, noteEndTime);

    // Release phase: ramp down to zero
    gain.linearRampToValueAtTime(0, noteEndTime + release);
}

/**
 * Apply an exponential ADSR envelope (more natural sounding).
 *
 * @param gainNode - The GainNode to apply the envelope to
 * @param envelope - ADSR envelope parameters
 * @param startTime - When to start the envelope (AudioContext time)
 * @param duration - Note duration in seconds
 * @param velocity - Note velocity 0-1
 */
export function applyExponentialEnvelope(
    gainNode: GainNode,
    envelope: ADSREnvelope,
    startTime: number,
    duration: number,
    velocity: number = 1.0
): void {
    const { attack, decay, sustain, release } = envelope;
    const gain = gainNode.gain;
    const maxGain = velocity;

    // Minimum value to avoid exponential to zero issues
    const minValue = 0.0001;

    // Cancel any previous automation
    gain.cancelScheduledValues(startTime);

    // Start at minimum
    gain.setValueAtTime(minValue, startTime);

    // Attack: exponential ramp to peak
    gain.exponentialRampToValueAtTime(maxGain, startTime + attack);

    // Decay: exponential ramp to sustain
    const sustainGain = Math.max(maxGain * sustain, minValue);
    gain.exponentialRampToValueAtTime(sustainGain, startTime + attack + decay);

    // Hold sustain
    const noteEndTime = startTime + duration;
    gain.setValueAtTime(sustainGain, noteEndTime);

    // Release: exponential ramp to minimum
    gain.exponentialRampToValueAtTime(minValue, noteEndTime + release);

    // Set to actual zero after release
    gain.setValueAtTime(0, noteEndTime + release + 0.001);
}

/**
 * Apply a plucked string envelope (instant attack, exponential decay).
 *
 * @param gainNode - The GainNode to apply the envelope to
 * @param startTime - When to start the envelope (AudioContext time)
 * @param decayTime - How long the decay should last
 * @param velocity - Note velocity 0-1
 */
export function applyPluckedEnvelope(
    gainNode: GainNode,
    startTime: number,
    decayTime: number,
    velocity: number = 1.0
): void {
    const gain = gainNode.gain;
    const minValue = 0.0001;

    gain.cancelScheduledValues(startTime);
    gain.setValueAtTime(velocity, startTime);
    gain.exponentialRampToValueAtTime(minValue, startTime + decayTime);
    gain.setValueAtTime(0, startTime + decayTime + 0.001);
}

/**
 * Apply a filter envelope (for dynamic brightness changes).
 *
 * @param filterNode - The BiquadFilterNode to apply the envelope to
 * @param startFreq - Starting cutoff frequency
 * @param peakFreq - Peak cutoff frequency
 * @param endFreq - Ending cutoff frequency
 * @param startTime - When to start the envelope
 * @param attackTime - Time to reach peak
 * @param decayTime - Time to reach end frequency
 */
export function applyFilterEnvelope(
    filterNode: BiquadFilterNode,
    startFreq: number,
    peakFreq: number,
    endFreq: number,
    startTime: number,
    attackTime: number,
    decayTime: number
): void {
    const freq = filterNode.frequency;

    freq.cancelScheduledValues(startTime);
    freq.setValueAtTime(startFreq, startTime);
    freq.exponentialRampToValueAtTime(peakFreq, startTime + attackTime);
    freq.exponentialRampToValueAtTime(Math.max(endFreq, 20), startTime + attackTime + decayTime);
}

/**
 * Create a simple gain ramp for smooth transitions.
 *
 * @param gainNode - The GainNode
 * @param targetValue - Target gain value
 * @param startTime - When to start the ramp
 * @param rampTime - Duration of the ramp
 */
export function smoothGainRamp(
    gainNode: GainNode,
    targetValue: number,
    startTime: number,
    rampTime: number
): void {
    gainNode.gain.linearRampToValueAtTime(targetValue, startTime + rampTime);
}

/**
 * Calculate the total envelope duration (attack + decay + release).
 * Useful for determining minimum note duration.
 */
export function getEnvelopeDuration(envelope: ADSREnvelope): number {
    return envelope.attack + envelope.decay + envelope.release;
}

/**
 * Scale an envelope by a factor (useful for tempo adjustments).
 */
export function scaleEnvelope(envelope: ADSREnvelope, factor: number): ADSREnvelope {
    return {
        attack: envelope.attack * factor,
        decay: envelope.decay * factor,
        sustain: envelope.sustain, // Sustain level doesn't scale
        release: envelope.release * factor,
    };
}

/**
 * Create an S-curve (sigmoid) array for smooth transitions.
 * Used for natural-sounding portamento and parameter changes.
 *
 * @param startValue - Starting value
 * @param endValue - Ending value
 * @param numSamples - Number of samples in the curve
 * @param steepness - How steep the S-curve is (higher = steeper, default 6)
 */
export function createSCurve(
    startValue: number,
    endValue: number,
    numSamples: number,
    steepness: number = 6
): Float32Array {
    const curve = new Float32Array(numSamples);
    const range = endValue - startValue;

    for (let i = 0; i < numSamples; i++) {
        // Normalize position to -1 to 1
        const x = (i / (numSamples - 1)) * 2 - 1;
        // Apply sigmoid function
        const sigmoid = 1 / (1 + Math.exp(-steepness * x));
        // Scale to value range
        curve[i] = startValue + range * sigmoid;
    }

    return curve;
}

/**
 * Apply S-curve portamento between two frequencies.
 *
 * @param param - The AudioParam to apply the curve to (e.g., oscillator.frequency)
 * @param startFreq - Starting frequency
 * @param endFreq - Ending frequency
 * @param startTime - When to start the transition
 * @param duration - Duration of the transition
 * @param steepness - S-curve steepness (default 6)
 */
export function applySCurvePortamento(
    param: AudioParam,
    startFreq: number,
    endFreq: number,
    startTime: number,
    duration: number,
    steepness: number = 6
): void {
    // Use 64 samples for smooth curve (Web Audio minimum is typically 2)
    const numSamples = 64;
    const curve = createSCurve(startFreq, endFreq, numSamples, steepness);

    param.cancelScheduledValues(startTime);
    param.setValueAtTime(startFreq, startTime);
    param.setValueCurveAtTime(curve, startTime, duration);
}
