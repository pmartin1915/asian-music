/**
 * Unit tests for BaseVoice abstract class.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { BaseVoice } from './BaseVoice';
import type { ScheduledNote, VoiceParameters, ADSREnvelope } from '../types';
import type { Instrument } from '../../types/music';

// Type for mocked AudioContext with vi.fn() methods
interface MockAudioContext extends BaseAudioContext {
    createGain: Mock;
    createOscillator: Mock;
    createBiquadFilter: Mock;
    createBuffer: Mock;
    createBufferSource: Mock;
}

// Mock the envelope module
vi.mock('../utils/envelope', () => ({
    applyADSREnvelope: vi.fn(),
}));

import { applyADSREnvelope } from '../utils/envelope';

// Concrete implementation for testing abstract class
class TestVoice extends BaseVoice {
    readonly instrument: Instrument = 'erhu';

    scheduleNote(_note: ScheduledNote, _destination: AudioNode): void {
        // Test implementation does nothing
    }

    // Expose protected methods for testing
    public testCreateEnvelopedGain(note: ScheduledNote, envelope: ADSREnvelope): GainNode {
        return this.createEnvelopedGain(note, envelope);
    }

    public testCreateLowpassFilter(cutoff: number, resonance?: number): BiquadFilterNode {
        return this.createLowpassFilter(cutoff, resonance);
    }

    public testCreateHighpassFilter(cutoff: number, resonance?: number): BiquadFilterNode {
        return this.createHighpassFilter(cutoff, resonance);
    }

    public testCreateBandpassFilter(centerFreq: number, q?: number): BiquadFilterNode {
        return this.createBandpassFilter(centerFreq, q);
    }

    public testCreateOscillator(frequency: number, type?: OscillatorType): OscillatorNode {
        return this.createOscillator(frequency, type);
    }

    public testCreateLFO(rate: number, depth: number, type?: OscillatorType) {
        return this.createLFO(rate, depth, type);
    }

    public testApplyVibrato(osc: OscillatorNode, rate: number, depthCents: number, startTime: number, duration: number) {
        return this.applyVibrato(osc, rate, depthCents, startTime, duration);
    }

    public testScheduleNode(node: OscillatorNode | AudioBufferSourceNode, startTime: number, stopTime: number) {
        return this.scheduleNode(node, startTime, stopTime);
    }

    public testCreateNoiseSource(duration: number): AudioBufferSourceNode {
        return this.createNoiseSource(duration);
    }

    public testEnvelope(): ADSREnvelope {
        return this.envelope;
    }

    public getActiveNodesCount(): number {
        return this.activeNodes.size;
    }
}

// Mock AudioContext
function createMockAudioContext() {
    const mockGain = {
        gain: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
    };

    const mockOscillator = {
        type: 'sine' as OscillatorType,
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
    };

    const mockFilter = {
        type: 'lowpass' as BiquadFilterType,
        frequency: { value: 0 },
        Q: { value: 1 },
        connect: vi.fn(),
    };

    const mockBuffer = {
        getChannelData: vi.fn(() => new Float32Array(44100)),
    };

    const mockBufferSource = {
        buffer: null as AudioBuffer | null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
    };

    return {
        createGain: vi.fn(() => ({ ...mockGain })),
        createOscillator: vi.fn(() => ({ ...mockOscillator })),
        createBiquadFilter: vi.fn(() => ({ ...mockFilter })),
        createBuffer: vi.fn(() => mockBuffer),
        createBufferSource: vi.fn(() => ({ ...mockBufferSource })),
        sampleRate: 44100,
    } as unknown as MockAudioContext;
}

function createMockParams(): VoiceParameters {
    return {
        filterCutoff: 3000,
        filterResonance: 2,
        envelope: {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.7,
            release: 0.3,
        },
        vibratoRate: 5,
        vibratoDepth: 25,
    };
}

function createMockNote(): ScheduledNote {
    return {
        pitch: 'C4',
        frequency: 261.63,
        startTime: 0,
        duration: 1,
        velocity: 0.8,
        instrument: 'erhu',
    };
}

describe('BaseVoice', () => {
    let context: MockAudioContext;
    let params: VoiceParameters;
    let voice: TestVoice;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockAudioContext();
        params = createMockParams();
        voice = new TestVoice(context, params);
    });

    describe('constructor', () => {
        it('creates master gain node', () => {
            expect(context.createGain).toHaveBeenCalled();
        });

        it('stores parameters as a copy', () => {
            const retrievedParams = voice.getParameters();
            expect(retrievedParams).toEqual(params);
            expect(retrievedParams).not.toBe(params);
        });
    });

    describe('connect', () => {
        it('connects master gain to destination', () => {
            const destination = {} as AudioNode;
            voice.connect(destination);

            const masterGain = context.createGain.mock.results[0].value;
            expect(masterGain.connect).toHaveBeenCalledWith(destination);
        });
    });

    describe('disconnect', () => {
        it('disconnects master gain', () => {
            voice.disconnect();

            const masterGain = context.createGain.mock.results[0].value;
            expect(masterGain.disconnect).toHaveBeenCalled();
        });
    });

    describe('setParameter', () => {
        it('updates parameter value', () => {
            voice.setParameter('filterCutoff', 5000);
            expect(voice.getParameters().filterCutoff).toBe(5000);
        });

        it('ignores unknown parameters', () => {
            // @ts-expect-error - Testing invalid parameter
            voice.setParameter('unknownParam', 100);
            // Should not throw
        });
    });

    describe('getParameters', () => {
        it('returns a copy of parameters', () => {
            const params1 = voice.getParameters();
            const params2 = voice.getParameters();
            expect(params1).toEqual(params2);
            expect(params1).not.toBe(params2);
        });
    });

    describe('dispose', () => {
        it('disconnects the voice', () => {
            const masterGain = context.createGain.mock.results[0].value;
            voice.dispose();
            expect(masterGain.disconnect).toHaveBeenCalled();
        });

        it('clears active nodes', () => {
            // First add some nodes
            const osc = context.createOscillator();
            voice.testScheduleNode(osc as unknown as OscillatorNode, 0, 1);

            voice.dispose();
            expect(voice.getActiveNodesCount()).toBe(0);
        });
    });

    describe('createEnvelopedGain', () => {
        it('creates gain node with initial value 0', () => {
            const note = createMockNote();
            voice.testCreateEnvelopedGain(note, params.envelope);

            const gainCalls = context.createGain.mock.results;
            // First call is master gain, second is the enveloped gain
            expect(gainCalls.length).toBe(2);
        });

        it('calls applyADSREnvelope with correct parameters', () => {
            const note = createMockNote();
            const envelope = params.envelope;

            voice.testCreateEnvelopedGain(note, envelope);

            expect(applyADSREnvelope).toHaveBeenCalledWith(
                expect.any(Object),
                envelope,
                note.startTime,
                note.duration,
                note.velocity
            );
        });
    });

    describe('createLowpassFilter', () => {
        it('creates lowpass filter with correct type', () => {
            voice.testCreateLowpassFilter(3000);

            expect(context.createBiquadFilter).toHaveBeenCalled();
            const filter = context.createBiquadFilter.mock.results[0].value;
            expect(filter.type).toBe('lowpass');
        });

        it('sets cutoff frequency', () => {
            voice.testCreateLowpassFilter(5000);

            const filter = context.createBiquadFilter.mock.results[0].value;
            expect(filter.frequency.value).toBe(5000);
        });

        it('sets resonance (Q)', () => {
            voice.testCreateLowpassFilter(3000, 4);

            const filter = context.createBiquadFilter.mock.results[0].value;
            expect(filter.Q.value).toBe(4);
        });

        it('uses default resonance of 1', () => {
            voice.testCreateLowpassFilter(3000);

            const filter = context.createBiquadFilter.mock.results[0].value;
            expect(filter.Q.value).toBe(1);
        });
    });

    describe('createHighpassFilter', () => {
        it('creates highpass filter', () => {
            voice.testCreateHighpassFilter(1000);

            const filter = context.createBiquadFilter.mock.results[0].value;
            expect(filter.type).toBe('highpass');
            expect(filter.frequency.value).toBe(1000);
        });
    });

    describe('createBandpassFilter', () => {
        it('creates bandpass filter', () => {
            voice.testCreateBandpassFilter(2000, 3);

            const filter = context.createBiquadFilter.mock.results[0].value;
            expect(filter.type).toBe('bandpass');
            expect(filter.frequency.value).toBe(2000);
            expect(filter.Q.value).toBe(3);
        });
    });

    describe('createOscillator', () => {
        it('creates oscillator with correct frequency', () => {
            voice.testCreateOscillator(440);

            expect(context.createOscillator).toHaveBeenCalled();
            const osc = context.createOscillator.mock.results[0].value;
            expect(osc.frequency.value).toBe(440);
        });

        it('creates oscillator with correct type', () => {
            voice.testCreateOscillator(440, 'sawtooth');

            const osc = context.createOscillator.mock.results[0].value;
            expect(osc.type).toBe('sawtooth');
        });

        it('uses sine as default type', () => {
            voice.testCreateOscillator(440);

            const osc = context.createOscillator.mock.results[0].value;
            expect(osc.type).toBe('sine');
        });
    });

    describe('createLFO', () => {
        it('creates oscillator for LFO', () => {
            voice.testCreateLFO(5, 10);

            expect(context.createOscillator).toHaveBeenCalled();
        });

        it('creates gain for depth control', () => {
            voice.testCreateLFO(5, 10);

            // One for master, one for LFO depth
            expect(context.createGain.mock.calls.length).toBe(2);
        });

        it('connects LFO to gain', () => {
            const result = voice.testCreateLFO(5, 10);

            expect(result.lfo).toBeDefined();
            expect(result.gain).toBeDefined();
        });

        it('sets correct LFO rate', () => {
            voice.testCreateLFO(8, 10);

            const osc = context.createOscillator.mock.results[0].value;
            expect(osc.frequency.value).toBe(8);
        });

        it('sets correct depth', () => {
            voice.testCreateLFO(5, 25);

            const gains = context.createGain.mock.results;
            const lfoGain = gains[gains.length - 1].value;
            expect(lfoGain.gain.value).toBe(25);
        });
    });

    describe('applyVibrato', () => {
        it('creates LFO oscillator for vibrato', () => {
            const osc = context.createOscillator() as unknown as OscillatorNode;
            osc.frequency.value = 440;

            voice.testApplyVibrato(osc, 5, 25, 0, 1);

            // Called once for main osc, once for vibrato LFO
            expect(context.createOscillator).toHaveBeenCalledTimes(2);
        });

        it('starts and stops vibrato LFO', () => {
            const mainOsc = context.createOscillator() as unknown as OscillatorNode;
            mainOsc.frequency.value = 440;

            voice.testApplyVibrato(mainOsc, 5, 25, 0, 1);

            const lfoOsc = context.createOscillator.mock.results[1].value;
            expect(lfoOsc.start).toHaveBeenCalledWith(0);
            expect(lfoOsc.stop).toHaveBeenCalledWith(1.5); // duration + 0.5
        });

        it('adds LFO to active nodes', () => {
            const mainOsc = context.createOscillator() as unknown as OscillatorNode;
            mainOsc.frequency.value = 440;

            voice.testApplyVibrato(mainOsc, 5, 25, 0, 1);

            expect(voice.getActiveNodesCount()).toBeGreaterThan(0);
        });
    });

    describe('scheduleNode', () => {
        it('starts node at specified time', () => {
            const osc = context.createOscillator() as unknown as OscillatorNode;

            voice.testScheduleNode(osc, 1, 2);

            expect(osc.start).toHaveBeenCalledWith(1);
        });

        it('stops node at specified time', () => {
            const osc = context.createOscillator() as unknown as OscillatorNode;

            voice.testScheduleNode(osc, 1, 2);

            expect(osc.stop).toHaveBeenCalledWith(2);
        });

        it('adds node to active nodes', () => {
            const osc = context.createOscillator() as unknown as OscillatorNode;

            voice.testScheduleNode(osc, 0, 1);

            expect(voice.getActiveNodesCount()).toBe(1);
        });

        it('removes node from active nodes on ended', () => {
            const osc = context.createOscillator() as unknown as OscillatorNode;

            voice.testScheduleNode(osc, 0, 1);
            expect(voice.getActiveNodesCount()).toBe(1);

            // Simulate onended callback
            if (osc.onended) {
                osc.onended(new Event('ended'));
            }

            expect(voice.getActiveNodesCount()).toBe(0);
        });
    });

    describe('createNoiseSource', () => {
        it('creates buffer with correct duration', () => {
            voice.testCreateNoiseSource(1);

            expect(context.createBuffer).toHaveBeenCalledWith(1, 44100, 44100);
        });

        it('creates buffer source', () => {
            voice.testCreateNoiseSource(1);

            expect(context.createBufferSource).toHaveBeenCalled();
        });

        it('creates longer buffers for longer durations', () => {
            voice.testCreateNoiseSource(2);

            expect(context.createBuffer).toHaveBeenCalledWith(1, 88200, 44100);
        });
    });

    describe('envelope getter', () => {
        it('returns envelope from params', () => {
            const envelope = voice.testEnvelope();
            expect(envelope).toEqual(params.envelope);
        });
    });
});
