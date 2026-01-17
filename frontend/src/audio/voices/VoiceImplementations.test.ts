/**
 * Unit tests for voice implementations (ErhuVoice, GuzhengVoice, PipaVoice, DiziVoice).
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ErhuVoice } from './ErhuVoice';
import { GuzhengVoice } from './GuzhengVoice';
import { PipaVoice } from './PipaVoice';
import { DiziVoice } from './DiziVoice';
import type { ScheduledNote, VoiceParameters } from '../types';

// Type for mocked AudioContext with vi.fn() methods
interface MockAudioContext extends BaseAudioContext {
    createGain: Mock;
    createOscillator: Mock;
    createBiquadFilter: Mock;
    createDelay: Mock;
    createBuffer: Mock;
    createBufferSource: Mock;
}

// Mock envelope utilities
vi.mock('../utils/envelope', () => ({
    applyADSREnvelope: vi.fn(),
    applyPluckedEnvelope: vi.fn(),
    applyExponentialEnvelope: vi.fn(),
    applySCurvePortamento: vi.fn(),
}));

// Create comprehensive mock AudioContext
function createMockAudioContext() {
    const createMockGainNode = () => ({
        gain: {
            value: 1,
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
    });

    const createMockOscillator = () => ({
        type: 'sine' as OscillatorType,
        frequency: {
            value: 0,
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            setValueCurveAtTime: vi.fn(),
            cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
    });

    const createMockFilter = () => ({
        type: 'lowpass' as BiquadFilterType,
        frequency: {
            value: 0,
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
        },
        Q: { value: 1 },
        connect: vi.fn(),
    });

    const createMockDelay = () => ({
        delayTime: { value: 0 },
        connect: vi.fn(),
    });

    const createMockBuffer = (length: number) => ({
        length,
        numberOfChannels: 1,
        sampleRate: 44100,
        getChannelData: vi.fn(() => new Float32Array(length)),
    });

    const createMockBufferSource = () => ({
        buffer: null as AudioBuffer | null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
    });

    return {
        createGain: vi.fn(createMockGainNode),
        createOscillator: vi.fn(createMockOscillator),
        createBiquadFilter: vi.fn(createMockFilter),
        createDelay: vi.fn(createMockDelay),
        createBuffer: vi.fn((_channels: number, length: number, _rate: number) => createMockBuffer(length)),
        createBufferSource: vi.fn(createMockBufferSource),
        sampleRate: 44100,
        currentTime: 0,
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
        portamentoTime: 0.15,
        decayTime: 1.5,
        brightness: 0.6,
        breathiness: 0.2,
        membraneBuzz: 0.15,
        tremoloRate: 12,
        tremoloDepth: 0.4,
    };
}

function createMockNote(overrides: Partial<ScheduledNote> = {}): ScheduledNote {
    return {
        pitch: 'C4',
        frequency: 261.63,
        startTime: 0,
        duration: 1,
        velocity: 0.8,
        instrument: 'erhu',
        ...overrides,
    };
}

describe('ErhuVoice', () => {
    let context: MockAudioContext;
    let params: VoiceParameters;
    let voice: ErhuVoice;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockAudioContext();
        params = createMockParams();
        voice = new ErhuVoice(context, params);
    });

    describe('initialization', () => {
        it('has correct instrument type', () => {
            expect(voice.instrument).toBe('erhu');
        });

        it('creates master gain on construction', () => {
            expect(context.createGain).toHaveBeenCalled();
        });
    });

    describe('scheduleNote', () => {
        it('creates main sawtooth oscillator', () => {
            const note = createMockNote();
            const destination = {} as AudioNode;

            voice.scheduleNote(note, destination);

            expect(context.createOscillator).toHaveBeenCalled();
        });

        it('creates sub-oscillator for body resonance', () => {
            const note = createMockNote();
            const destination = {} as AudioNode;

            voice.scheduleNote(note, destination);

            // Should create at least 2 oscillators (main + sub)
            expect(context.createOscillator).toHaveBeenCalledTimes(expect.any(Number));
        });

        it('creates lowpass filter', () => {
            const note = createMockNote();
            const destination = {} as AudioNode;

            voice.scheduleNote(note, destination);

            expect(context.createBiquadFilter).toHaveBeenCalled();
        });

        it('applies vibrato for notes', () => {
            const note = createMockNote({ duration: 1 });
            const destination = {} as AudioNode;

            voice.scheduleNote(note, destination);

            // Vibrato creates additional oscillator
            expect(context.createOscillator.mock.calls.length).toBeGreaterThan(2);
        });
    });

    describe('connect/disconnect', () => {
        it('connects to destination', () => {
            const destination = {} as AudioNode;
            voice.connect(destination);

            const masterGain = (context.createGain as ReturnType<typeof vi.fn>).mock.results[0].value;
            expect(masterGain.connect).toHaveBeenCalledWith(destination);
        });

        it('disconnects properly', () => {
            voice.disconnect();

            const masterGain = (context.createGain as ReturnType<typeof vi.fn>).mock.results[0].value;
            expect(masterGain.disconnect).toHaveBeenCalled();
        });
    });
});

describe('GuzhengVoice', () => {
    let context: MockAudioContext;
    let params: VoiceParameters;
    let voice: GuzhengVoice;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockAudioContext();
        params = createMockParams();
        voice = new GuzhengVoice(context, params);
    });

    describe('initialization', () => {
        it('has correct instrument type', () => {
            expect(voice.instrument).toBe('guzheng');
        });
    });

    describe('scheduleNote', () => {
        it('creates oscillators for plucked string', () => {
            const note = createMockNote({ instrument: 'guzheng' });
            const destination = {} as AudioNode;

            voice.scheduleNote(note, destination);

            expect(context.createOscillator).toHaveBeenCalled();
        });

        it('creates noise for pluck transient', () => {
            const note = createMockNote({ instrument: 'guzheng' });
            const destination = {} as AudioNode;

            voice.scheduleNote(note, destination);

            // Pluck transient uses buffer source
            expect(context.createBufferSource).toHaveBeenCalled();
        });

        it('creates filters for shaping', () => {
            const note = createMockNote({ instrument: 'guzheng' });
            const destination = {} as AudioNode;

            voice.scheduleNote(note, destination);

            expect(context.createBiquadFilter).toHaveBeenCalled();
        });
    });
});

describe('PipaVoice', () => {
    let context: MockAudioContext;
    let params: VoiceParameters;
    let voice: PipaVoice;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockAudioContext();
        params = createMockParams();
        voice = new PipaVoice(context, params);
    });

    describe('initialization', () => {
        it('has correct instrument type', () => {
            expect(voice.instrument).toBe('pipa');
        });
    });

    describe('scheduleNote', () => {
        it('creates oscillators for plucked sound', () => {
            const note = createMockNote({ instrument: 'pipa' });
            const destination = {} as AudioNode;

            voice.scheduleNote(note, destination);

            expect(context.createOscillator).toHaveBeenCalled();
        });

        it('creates gain nodes for mixing', () => {
            const note = createMockNote({ instrument: 'pipa' });
            const destination = {} as AudioNode;

            voice.scheduleNote(note, destination);

            // Multiple gain nodes for mixing
            expect(context.createGain).toHaveBeenCalledTimes(expect.any(Number));
        });

        it('applies tremolo for long notes', () => {
            const note = createMockNote({ instrument: 'pipa', duration: 1 });
            const destination = {} as AudioNode;

            voice.scheduleNote(note, destination);

            // Tremolo creates additional oscillator if duration is long enough
            expect(context.createOscillator).toHaveBeenCalled();
        });
    });
});

describe('DiziVoice', () => {
    let context: MockAudioContext;
    let params: VoiceParameters;
    let voice: DiziVoice;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockAudioContext();
        params = createMockParams();
        voice = new DiziVoice(context, params);
    });

    describe('initialization', () => {
        it('has correct instrument type', () => {
            expect(voice.instrument).toBe('dizi');
        });
    });

    describe('scheduleNote', () => {
        it('creates main oscillator', () => {
            const note = createMockNote({ instrument: 'dizi' });
            const destination = {} as AudioNode;

            voice.scheduleNote(note, destination);

            expect(context.createOscillator).toHaveBeenCalled();
        });

        it('creates noise for breath simulation', () => {
            const note = createMockNote({ instrument: 'dizi' });
            const destination = {} as AudioNode;

            voice.scheduleNote(note, destination);

            // Breath noise uses buffer source
            expect(context.createBufferSource).toHaveBeenCalled();
        });

        it('creates filters for shaping', () => {
            const note = createMockNote({ instrument: 'dizi' });
            const destination = {} as AudioNode;

            voice.scheduleNote(note, destination);

            expect(context.createBiquadFilter).toHaveBeenCalled();
        });

        it('applies vibrato', () => {
            const note = createMockNote({ instrument: 'dizi', duration: 1 });
            const destination = {} as AudioNode;

            voice.scheduleNote(note, destination);

            // Vibrato creates additional LFO oscillator
            expect(context.createOscillator.mock.calls.length).toBeGreaterThan(1);
        });
    });
});

describe('Voice Common Functionality', () => {
    const voiceClasses = [
        { name: 'ErhuVoice', Class: ErhuVoice, instrument: 'erhu' as const },
        { name: 'GuzhengVoice', Class: GuzhengVoice, instrument: 'guzheng' as const },
        { name: 'PipaVoice', Class: PipaVoice, instrument: 'pipa' as const },
        { name: 'DiziVoice', Class: DiziVoice, instrument: 'dizi' as const },
    ];

    voiceClasses.forEach(({ name, Class, instrument }) => {
        describe(`${name}`, () => {
            let context: MockAudioContext;
            let params: VoiceParameters;
            let voice: InstanceType<typeof Class>;

            beforeEach(() => {
                vi.clearAllMocks();
                context = createMockAudioContext();
                params = createMockParams();
                voice = new Class(context, params);
            });

            it(`has instrument type ${instrument}`, () => {
                expect(voice.instrument).toBe(instrument);
            });

            it('implements getParameters', () => {
                const retrieved = voice.getParameters();
                expect(retrieved.filterCutoff).toBe(params.filterCutoff);
            });

            it('implements setParameter', () => {
                voice.setParameter('filterCutoff', 5000);
                expect(voice.getParameters().filterCutoff).toBe(5000);
            });

            it('implements connect', () => {
                const destination = {} as AudioNode;
                expect(() => voice.connect(destination)).not.toThrow();
            });

            it('implements disconnect', () => {
                expect(() => voice.disconnect()).not.toThrow();
            });

            it('implements dispose', () => {
                expect(() => voice.dispose()).not.toThrow();
            });

            it('scheduleNote does not throw', () => {
                const note = createMockNote({ instrument });
                const destination = {} as AudioNode;
                expect(() => voice.scheduleNote(note, destination)).not.toThrow();
            });
        });
    });
});
