/**
 * Unit tests for ADSR envelope utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    ENVELOPE_PRESETS,
    applyADSREnvelope,
    applyExponentialEnvelope,
    applyPluckedEnvelope,
    applyFilterEnvelope,
    smoothGainRamp,
    getEnvelopeDuration,
    scaleEnvelope,
    createSCurve,
    applySCurvePortamento
} from './envelope';
import type { ADSREnvelope } from '../types';

// Mock GainNode
function createMockGainNode() {
    return {
        gain: {
            value: 1,
            cancelScheduledValues: vi.fn(),
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            setValueCurveAtTime: vi.fn(),
        }
    } as unknown as GainNode;
}

// Mock BiquadFilterNode
function createMockFilterNode() {
    return {
        frequency: {
            value: 1000,
            cancelScheduledValues: vi.fn(),
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
        }
    } as unknown as BiquadFilterNode;
}

// Mock AudioParam
function createMockAudioParam() {
    return {
        value: 440,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        setValueCurveAtTime: vi.fn(),
    } as unknown as AudioParam;
}

describe('envelope.ts', () => {

    describe('ENVELOPE_PRESETS', () => {
        it('has sustained preset', () => {
            expect(ENVELOPE_PRESETS.sustained).toBeDefined();
            expect(ENVELOPE_PRESETS.sustained.attack).toBeGreaterThan(0);
            expect(ENVELOPE_PRESETS.sustained.sustain).toBeGreaterThan(0);
        });

        it('has plucked preset with zero sustain', () => {
            expect(ENVELOPE_PRESETS.plucked).toBeDefined();
            expect(ENVELOPE_PRESETS.plucked.sustain).toBe(0);
            expect(ENVELOPE_PRESETS.plucked.attack).toBeLessThan(0.01);
        });

        it('has percussive preset with very fast attack', () => {
            expect(ENVELOPE_PRESETS.percussive).toBeDefined();
            expect(ENVELOPE_PRESETS.percussive.attack).toBeLessThan(0.01);
        });

        it('has breath preset', () => {
            expect(ENVELOPE_PRESETS.breath).toBeDefined();
        });

        it('has pad preset with slow attack', () => {
            expect(ENVELOPE_PRESETS.pad).toBeDefined();
            expect(ENVELOPE_PRESETS.pad.attack).toBeGreaterThan(0.2);
        });

        it('all presets have valid ADSR values', () => {
            Object.values(ENVELOPE_PRESETS).forEach(env => {
                expect(env.attack).toBeGreaterThanOrEqual(0);
                expect(env.decay).toBeGreaterThanOrEqual(0);
                expect(env.sustain).toBeGreaterThanOrEqual(0);
                expect(env.sustain).toBeLessThanOrEqual(1);
                expect(env.release).toBeGreaterThanOrEqual(0);
            });
        });
    });

    describe('applyADSREnvelope', () => {
        let gainNode: GainNode;
        const envelope: ADSREnvelope = {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.7,
            release: 0.3
        };

        beforeEach(() => {
            gainNode = createMockGainNode();
        });

        it('cancels previous scheduled values', () => {
            applyADSREnvelope(gainNode, envelope, 0, 1);
            expect(gainNode.gain.cancelScheduledValues).toHaveBeenCalledWith(0);
        });

        it('starts at zero', () => {
            applyADSREnvelope(gainNode, envelope, 0, 1);
            expect(gainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
        });

        it('ramps to velocity during attack', () => {
            applyADSREnvelope(gainNode, envelope, 0, 1, 0.8);
            expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.8, 0.1);
        });

        it('decays to sustain level', () => {
            applyADSREnvelope(gainNode, envelope, 0, 1, 1.0);
            // Sustain level = 1.0 * 0.7 = 0.7, at time attack + decay = 0.1 + 0.2
            const calls = (gainNode.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>).mock.calls;
            const decayCall = calls.find((c: number[]) => Math.abs(c[0] - 0.7) < 0.001);
            expect(decayCall).toBeDefined();
            expect(decayCall![1]).toBeCloseTo(0.3, 5);
        });

        it('releases to zero after note ends', () => {
            applyADSREnvelope(gainNode, envelope, 0, 1, 1.0);
            // Note end at 1s, release ends at 1.3s
            expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1.3);
        });

        it('uses default velocity of 1.0', () => {
            applyADSREnvelope(gainNode, envelope, 0, 1);
            expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, 0.1);
        });

        it('handles custom start time', () => {
            applyADSREnvelope(gainNode, envelope, 5, 1);
            expect(gainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, 5);
            expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, 5.1);
        });
    });

    describe('applyExponentialEnvelope', () => {
        let gainNode: GainNode;
        const envelope: ADSREnvelope = {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.5,
            release: 0.3
        };

        beforeEach(() => {
            gainNode = createMockGainNode();
        });

        it('starts at minimum value (not zero)', () => {
            applyExponentialEnvelope(gainNode, envelope, 0, 1);
            expect(gainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 0);
        });

        it('uses exponential ramps', () => {
            applyExponentialEnvelope(gainNode, envelope, 0, 1, 1.0);
            expect(gainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
        });

        it('sets to actual zero after release', () => {
            applyExponentialEnvelope(gainNode, envelope, 0, 1);
            // After release ends at 1.3s + 0.001
            expect(gainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, 1.301);
        });

        it('handles zero sustain (uses minValue)', () => {
            const zeroSustainEnv: ADSREnvelope = {
                attack: 0.1,
                decay: 0.2,
                sustain: 0,
                release: 0.3
            };
            applyExponentialEnvelope(gainNode, zeroSustainEnv, 0, 1);
            // Should use 0.0001 instead of 0 for exponential, at time attack + decay
            const calls = (gainNode.gain.exponentialRampToValueAtTime as ReturnType<typeof vi.fn>).mock.calls;
            const sustainCall = calls.find((c: number[]) => Math.abs(c[0] - 0.0001) < 0.00001);
            expect(sustainCall).toBeDefined();
            expect(sustainCall![1]).toBeCloseTo(0.3, 5);
        });
    });

    describe('applyPluckedEnvelope', () => {
        let gainNode: GainNode;

        beforeEach(() => {
            gainNode = createMockGainNode();
        });

        it('starts at full velocity immediately', () => {
            applyPluckedEnvelope(gainNode, 0, 1, 0.8);
            expect(gainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.8, 0);
        });

        it('decays exponentially', () => {
            applyPluckedEnvelope(gainNode, 0, 1);
            expect(gainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
        });

        it('sets to zero after decay', () => {
            applyPluckedEnvelope(gainNode, 0, 1);
            expect(gainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, 1.001);
        });

        it('uses default velocity of 1.0', () => {
            applyPluckedEnvelope(gainNode, 0, 1);
            expect(gainNode.gain.setValueAtTime).toHaveBeenCalledWith(1, 0);
        });
    });

    describe('applyFilterEnvelope', () => {
        let filterNode: BiquadFilterNode;

        beforeEach(() => {
            filterNode = createMockFilterNode();
        });

        it('starts at start frequency', () => {
            applyFilterEnvelope(filterNode, 1000, 5000, 2000, 0, 0.1, 0.2);
            expect(filterNode.frequency.setValueAtTime).toHaveBeenCalledWith(1000, 0);
        });

        it('ramps to peak frequency', () => {
            applyFilterEnvelope(filterNode, 1000, 5000, 2000, 0, 0.1, 0.2);
            expect(filterNode.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(5000, 0.1);
        });

        it('decays to end frequency', () => {
            applyFilterEnvelope(filterNode, 1000, 5000, 2000, 0, 0.1, 0.2);
            const calls = (filterNode.frequency.exponentialRampToValueAtTime as ReturnType<typeof vi.fn>).mock.calls;
            const decayCall = calls.find((c: number[]) => c[0] === 2000);
            expect(decayCall).toBeDefined();
            expect(decayCall![1]).toBeCloseTo(0.3, 5);
        });

        it('clamps end frequency to minimum of 20 Hz', () => {
            applyFilterEnvelope(filterNode, 1000, 5000, 10, 0, 0.1, 0.2);
            const calls = (filterNode.frequency.exponentialRampToValueAtTime as ReturnType<typeof vi.fn>).mock.calls;
            const decayCall = calls.find((c: number[]) => c[0] === 20);
            expect(decayCall).toBeDefined();
            expect(decayCall![1]).toBeCloseTo(0.3, 5);
        });
    });

    describe('smoothGainRamp', () => {
        let gainNode: GainNode;

        beforeEach(() => {
            gainNode = createMockGainNode();
        });

        it('ramps to target value', () => {
            smoothGainRamp(gainNode, 0.5, 0, 0.1);
            expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, 0.1);
        });

        it('handles custom start time', () => {
            smoothGainRamp(gainNode, 0.5, 2, 0.1);
            expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, 2.1);
        });
    });

    describe('getEnvelopeDuration', () => {
        it('sums attack, decay, and release', () => {
            const envelope: ADSREnvelope = {
                attack: 0.1,
                decay: 0.2,
                sustain: 0.5,
                release: 0.3
            };
            expect(getEnvelopeDuration(envelope)).toBeCloseTo(0.6, 5);
        });

        it('handles zero values', () => {
            const envelope: ADSREnvelope = {
                attack: 0,
                decay: 0,
                sustain: 1,
                release: 0
            };
            expect(getEnvelopeDuration(envelope)).toBe(0);
        });
    });

    describe('scaleEnvelope', () => {
        const envelope: ADSREnvelope = {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.5,
            release: 0.3
        };

        it('scales attack, decay, and release by factor', () => {
            const scaled = scaleEnvelope(envelope, 2);
            expect(scaled.attack).toBe(0.2);
            expect(scaled.decay).toBe(0.4);
            expect(scaled.release).toBe(0.6);
        });

        it('does not scale sustain level', () => {
            const scaled = scaleEnvelope(envelope, 2);
            expect(scaled.sustain).toBe(0.5);
        });

        it('handles factor less than 1', () => {
            const scaled = scaleEnvelope(envelope, 0.5);
            expect(scaled.attack).toBe(0.05);
            expect(scaled.decay).toBe(0.1);
            expect(scaled.release).toBe(0.15);
        });

        it('returns new object (not mutating original)', () => {
            const scaled = scaleEnvelope(envelope, 2);
            expect(scaled).not.toBe(envelope);
            expect(envelope.attack).toBe(0.1);
        });
    });

    describe('createSCurve', () => {
        it('creates Float32Array of correct length', () => {
            const curve = createSCurve(0, 1, 64);
            expect(curve).toBeInstanceOf(Float32Array);
            expect(curve.length).toBe(64);
        });

        it('starts at start value', () => {
            const curve = createSCurve(100, 500, 64);
            // Sigmoid asymptotically approaches start, so use reasonable tolerance
            expect(curve[0]).toBeCloseTo(100, -1); // Within ~10 of 100
        });

        it('ends at end value', () => {
            const curve = createSCurve(100, 500, 64);
            // Sigmoid asymptotically approaches end, so use reasonable tolerance
            expect(curve[63]).toBeCloseTo(500, -1); // Within ~10 of 500
        });

        it('has middle value approximately at midpoint', () => {
            const curve = createSCurve(0, 100, 64);
            // S-curve midpoint should be close to 50 (within 10)
            expect(curve[31]).toBeCloseTo(50, -1);
        });

        it('handles decreasing values', () => {
            const curve = createSCurve(100, 0, 64);
            expect(curve[0]).toBeCloseTo(100, 0);
            expect(curve[63]).toBeCloseTo(0, 0);
        });

        it('higher steepness creates sharper transition', () => {
            const gentle = createSCurve(0, 100, 64, 2);
            const steep = createSCurve(0, 100, 64, 10);
            // At 1/4 point, steep curve should be closer to start
            expect(gentle[16]).toBeGreaterThan(steep[16]);
        });
    });

    describe('applySCurvePortamento', () => {
        let param: AudioParam;

        beforeEach(() => {
            param = createMockAudioParam();
        });

        it('cancels previous scheduled values', () => {
            applySCurvePortamento(param, 440, 880, 0, 0.1);
            expect(param.cancelScheduledValues).toHaveBeenCalledWith(0);
        });

        it('sets initial value', () => {
            applySCurvePortamento(param, 440, 880, 0, 0.1);
            expect(param.setValueAtTime).toHaveBeenCalledWith(440, 0);
        });

        it('applies value curve', () => {
            applySCurvePortamento(param, 440, 880, 0, 0.1);
            expect(param.setValueCurveAtTime).toHaveBeenCalled();
            const call = (param.setValueCurveAtTime as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(call[0]).toBeInstanceOf(Float32Array);
            expect(call[1]).toBe(0); // startTime
            expect(call[2]).toBe(0.1); // duration
        });

        it('handles custom steepness', () => {
            applySCurvePortamento(param, 440, 880, 0, 0.1, 10);
            expect(param.setValueCurveAtTime).toHaveBeenCalled();
        });
    });
});
