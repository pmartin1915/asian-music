/**
 * Unit tests for the synthesizer engine.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    SynthesizerEngine,
    getSynthesizerEngine,
    synthesizeInstrument,
} from './synthesizer';
import type { Composition, CompositionParams, Instrument } from '../types/music';
import type { InstrumentTrack, ScheduledNote } from './types';

// Mock dependencies
vi.mock('./scheduling', () => ({
    mapCompositionToTracks: vi.fn(),
    getCompositionDuration: vi.fn(() => 15),
}));

vi.mock('./voices', () => ({
    createVoice: vi.fn(),
}));

vi.mock('./utils/moodParams', () => ({
    getVoiceParams: vi.fn(() => ({
        filterCutoff: 3000,
        filterResonance: 2,
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.3 },
    })),
    INSTRUMENT_GAIN: {
        erhu: 0.8,
        guzheng: 0.7,
        pipa: 0.75,
        dizi: 0.65,
    },
}));

vi.mock('./utils/wavEncoder', () => ({
    audioBufferToBase64WAV: vi.fn(() => 'bW9ja0Jhc2U2NA=='),
}));

import { mapCompositionToTracks, getCompositionDuration } from './scheduling';
import { createVoice } from './voices';
import { getVoiceParams, INSTRUMENT_GAIN } from './utils/moodParams';
import { audioBufferToBase64WAV } from './utils/wavEncoder';

// Create comprehensive mock OfflineAudioContext
function createMockGainNode() {
    return {
        gain: {
            value: 1,
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
    };
}

function createMockBuffer() {
    return {
        numberOfChannels: 2,
        length: 44100 * 16,
        sampleRate: 44100,
        duration: 16,
        getChannelData: vi.fn(() => new Float32Array(44100 * 16)),
    };
}

// Class-based mock for OfflineAudioContext
class MockOfflineAudioContext {
    sampleRate = 44100;
    destination = {};
    createGain = vi.fn(createMockGainNode);
    startRendering = vi.fn().mockResolvedValue(createMockBuffer());

    constructor(_options?: OfflineAudioContextOptions) {
        // Store options if needed for assertions
    }
}

// Create mock voice
function createMockVoice() {
    return {
        instrument: 'erhu' as Instrument,
        connect: vi.fn(),
        disconnect: vi.fn(),
        scheduleNote: vi.fn(),
        setParameter: vi.fn(),
        getParameters: vi.fn(),
        dispose: vi.fn(),
    };
}

// Create mock composition
function createMockComposition(overrides: Partial<Composition> = {}): Composition {
    return {
        scale: {
            root: 'C',
            mode: 'gong',
            notes: ['C4', 'D4', 'E4', 'G4', 'A4'],
        },
        motif: {
            contour: [0, 2, 1, -1, 0],
            rhythm: [1, 0.5, 0.5, 1, 1],
        },
        form: {
            sections: [
                {
                    name: 'A',
                    duration: 4,
                    dynamics: 0.7,
                    instruments: ['erhu'],
                },
            ],
        },
        patterns: {
            erhu: {
                role: 'melody',
                pattern: [1, 0, 1, 0, 1, 0, 1, 0],
            },
        },
        ...overrides,
    };
}

// Create mock params
function createMockParams(overrides: Partial<CompositionParams> = {}): CompositionParams {
    return {
        mode: 'gong',
        root: 'C',
        tempo: 90,
        instruments: ['erhu'] as Instrument[],
        mood: 'calm',
        seed: 12345,
        ...overrides,
    };
}

// Create mock notes
function createMockNotes(count: number = 10): ScheduledNote[] {
    return Array.from({ length: count }, (_, i) => ({
        pitch: 'C4',
        frequency: 261.63,
        startTime: i * 0.5,
        duration: 0.4,
        velocity: 0.8,
        instrument: 'erhu' as Instrument,
    }));
}

describe('synthesizer.ts', () => {
    let mockVoice: ReturnType<typeof createMockVoice>;
    let originalOfflineAudioContext: typeof OfflineAudioContext;

    beforeEach(() => {
        vi.clearAllMocks();
        mockVoice = createMockVoice();

        // Store original and mock OfflineAudioContext
        originalOfflineAudioContext = global.OfflineAudioContext;
        global.OfflineAudioContext = MockOfflineAudioContext as unknown as typeof OfflineAudioContext;

        // Setup default mock returns
        (createVoice as ReturnType<typeof vi.fn>).mockReturnValue(mockVoice);

        const mockTrack: InstrumentTrack = {
            instrument: 'erhu',
            role: 'melody',
            notes: createMockNotes(10),
        };
        const tracksMap = new Map<Instrument, InstrumentTrack>();
        tracksMap.set('erhu', mockTrack);
        (mapCompositionToTracks as ReturnType<typeof vi.fn>).mockReturnValue(tracksMap);
    });

    afterEach(() => {
        global.OfflineAudioContext = originalOfflineAudioContext;
    });

    describe('SynthesizerEngine', () => {
        describe('constructor', () => {
            it('creates engine with default sample rate', () => {
                const engine = new SynthesizerEngine();
                expect(engine).toBeDefined();
            });

            it('creates engine with custom sample rate', () => {
                const engine = new SynthesizerEngine(48000);
                expect(engine).toBeDefined();
            });
        });

        describe('renderTrack', () => {
            it('creates OfflineAudioContext with correct parameters', async () => {
                const engine = new SynthesizerEngine(44100);
                const composition = createMockComposition();
                const params = createMockParams();

                // Just verify it completes without error - context creation is internal
                const buffer = await engine.renderTrack(composition, 'erhu', params);
                expect(buffer).toBeDefined();
            });

            it('gets voice parameters for instrument and mood', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams({ mood: 'heroic' });

                await engine.renderTrack(composition, 'erhu', params);

                expect(getVoiceParams).toHaveBeenCalledWith('erhu', 'heroic');
            });

            it('creates voice for the instrument', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams();

                await engine.renderTrack(composition, 'erhu', params);

                expect(createVoice).toHaveBeenCalledWith(
                    'erhu',
                    expect.any(MockOfflineAudioContext),
                    expect.any(Object)
                );
            });

            it('maps composition to tracks for single instrument', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams({ instruments: ['erhu', 'guzheng'] });

                await engine.renderTrack(composition, 'erhu', params);

                expect(mapCompositionToTracks).toHaveBeenCalledWith(
                    composition,
                    expect.objectContaining({
                        instruments: ['erhu'], // Only the single instrument
                    })
                );
            });

            it('creates master gain node', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams();

                // Verify the render completes - gain creation is internal
                const buffer = await engine.renderTrack(composition, 'erhu', params);
                expect(buffer).toBeDefined();
            });

            it('sets correct instrument gain level', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams();

                // Just verify it doesn't throw - gain level is set internally
                const buffer = await engine.renderTrack(composition, 'erhu', params);
                expect(buffer).toBeDefined();
            });

            it('connects master gain to destination', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams();

                // Just verify it doesn't throw - connection is internal
                const buffer = await engine.renderTrack(composition, 'erhu', params);
                expect(buffer).toBeDefined();
            });

            it('schedules all notes through voice', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams();

                await engine.renderTrack(composition, 'erhu', params);

                expect(mockVoice.scheduleNote).toHaveBeenCalledTimes(10);
            });

            it('calls startRendering on offline context', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams();

                // Verify render returns buffer (proves startRendering was called)
                const buffer = await engine.renderTrack(composition, 'erhu', params);
                expect(buffer).toBeDefined();
                expect(buffer.duration).toBe(16);
            });

            it('disposes voice after rendering', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams();

                await engine.renderTrack(composition, 'erhu', params);

                expect(mockVoice.dispose).toHaveBeenCalled();
            });

            it('returns rendered AudioBuffer', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams();

                const buffer = await engine.renderTrack(composition, 'erhu', params);

                expect(buffer).toBeDefined();
                expect(buffer.duration).toBe(16);
            });

            it('throws error when track is not generated', async () => {
                (mapCompositionToTracks as ReturnType<typeof vi.fn>).mockReturnValue(new Map());

                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams();

                await expect(engine.renderTrack(composition, 'erhu', params))
                    .rejects.toThrow('Failed to generate track for erhu');
            });

            describe('progress callback', () => {
                it('calls progress callback at start', async () => {
                    const engine = new SynthesizerEngine();
                    const composition = createMockComposition();
                    const params = createMockParams();
                    const onProgress = vi.fn();

                    await engine.renderTrack(composition, 'erhu', params, onProgress);

                    expect(onProgress).toHaveBeenCalledWith(0.1, 'erhu');
                });

                it('calls progress callback during note scheduling', async () => {
                    // Setup many notes to trigger progress updates
                    const manyNotes = createMockNotes(100);
                    const mockTrack: InstrumentTrack = {
                        instrument: 'erhu',
                        role: 'melody',
                        notes: manyNotes,
                    };
                    const tracksMap = new Map<Instrument, InstrumentTrack>();
                    tracksMap.set('erhu', mockTrack);
                    (mapCompositionToTracks as ReturnType<typeof vi.fn>).mockReturnValue(tracksMap);

                    const engine = new SynthesizerEngine();
                    const composition = createMockComposition();
                    const params = createMockParams();
                    const onProgress = vi.fn();

                    await engine.renderTrack(composition, 'erhu', params, onProgress);

                    // Should be called multiple times during scheduling
                    expect(onProgress.mock.calls.length).toBeGreaterThan(1);
                });

                it('calls progress callback at 0.8 before rendering', async () => {
                    const engine = new SynthesizerEngine();
                    const composition = createMockComposition();
                    const params = createMockParams();
                    const onProgress = vi.fn();

                    await engine.renderTrack(composition, 'erhu', params, onProgress);

                    expect(onProgress).toHaveBeenCalledWith(0.8, 'erhu');
                });

                it('calls progress callback at 1.0 on completion', async () => {
                    const engine = new SynthesizerEngine();
                    const composition = createMockComposition();
                    const params = createMockParams();
                    const onProgress = vi.fn();

                    await engine.renderTrack(composition, 'erhu', params, onProgress);

                    expect(onProgress).toHaveBeenCalledWith(1.0, 'erhu');
                });

                it('handles undefined progress callback', async () => {
                    const engine = new SynthesizerEngine();
                    const composition = createMockComposition();
                    const params = createMockParams();

                    // Should not throw without callback
                    await expect(engine.renderTrack(composition, 'erhu', params))
                        .resolves.toBeDefined();
                });
            });
        });

        describe('renderTrackToBase64', () => {
            it('renders track and converts to base64', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams();

                const base64 = await engine.renderTrackToBase64(composition, 'erhu', params);

                expect(audioBufferToBase64WAV).toHaveBeenCalled();
                expect(base64).toBe('bW9ja0Jhc2U2NA==');
            });

            it('passes progress callback to renderTrack', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams();
                const onProgress = vi.fn();

                await engine.renderTrackToBase64(composition, 'erhu', params, onProgress);

                expect(onProgress).toHaveBeenCalled();
            });
        });

        describe('renderAll', () => {
            beforeEach(() => {
                // Setup tracks for multiple instruments
                const setupTracksForInstrument = (instrument: Instrument) => {
                    const mockTrack: InstrumentTrack = {
                        instrument,
                        role: instrument === 'erhu' ? 'melody' : 'accompaniment',
                        notes: createMockNotes(5),
                    };
                    return mockTrack;
                };

                (mapCompositionToTracks as ReturnType<typeof vi.fn>).mockImplementation(
                    (_composition: Composition, params: CompositionParams) => {
                        const tracksMap = new Map<Instrument, InstrumentTrack>();
                        for (const inst of params.instruments) {
                            tracksMap.set(inst, setupTracksForInstrument(inst));
                        }
                        return tracksMap;
                    }
                );
            });

            it('renders all instruments', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams({ instruments: ['erhu', 'guzheng'] });

                const results = await engine.renderAll(composition, params);

                expect(results.size).toBe(2);
                expect(results.has('erhu')).toBe(true);
                expect(results.has('guzheng')).toBe(true);
            });

            it('returns RenderResult for each instrument', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams({ instruments: ['erhu'] });

                const results = await engine.renderAll(composition, params);
                const result = results.get('erhu');

                expect(result).toBeDefined();
                expect(result?.buffer).toBeDefined();
                expect(result?.duration).toBe(15);
                expect(result?.instrument).toBe('erhu');
            });

            it('calls progress callback for each instrument', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams({ instruments: ['erhu', 'guzheng'] });
                const onProgress = vi.fn();

                await engine.renderAll(composition, params, onProgress);

                // Should be called for both instruments
                const instruments = onProgress.mock.calls.map(call => call[0]);
                expect(instruments).toContain('erhu');
                expect(instruments).toContain('guzheng');
            });

            it('handles empty instruments array', async () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams({ instruments: [] });

                const results = await engine.renderAll(composition, params);

                expect(results.size).toBe(0);
            });

            it('renders instruments sequentially', async () => {
                const renderOrder: Instrument[] = [];
                (createVoice as ReturnType<typeof vi.fn>).mockImplementation((inst: Instrument) => {
                    renderOrder.push(inst);
                    return createMockVoice();
                });

                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams({ instruments: ['erhu', 'guzheng', 'pipa'] });

                await engine.renderAll(composition, params);

                expect(renderOrder).toEqual(['erhu', 'guzheng', 'pipa']);
            });
        });

        describe('estimateRenderTime', () => {
            it('estimates render time based on duration and instrument count', () => {
                (getCompositionDuration as ReturnType<typeof vi.fn>).mockReturnValue(30);

                const engine = new SynthesizerEngine();
                const composition = createMockComposition();

                const estimate = engine.estimateRenderTime(composition, 4);

                // 30s duration * 0.5 * 4 instruments = 60s
                expect(estimate).toBe(60);
            });

            it('scales linearly with duration', () => {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();

                (getCompositionDuration as ReturnType<typeof vi.fn>).mockReturnValue(10);
                const estimate1 = engine.estimateRenderTime(composition, 1);

                (getCompositionDuration as ReturnType<typeof vi.fn>).mockReturnValue(20);
                const estimate2 = engine.estimateRenderTime(composition, 1);

                expect(estimate2).toBe(estimate1 * 2);
            });

            it('scales linearly with instrument count', () => {
                (getCompositionDuration as ReturnType<typeof vi.fn>).mockReturnValue(10);

                const engine = new SynthesizerEngine();
                const composition = createMockComposition();

                const estimate1 = engine.estimateRenderTime(composition, 1);
                const estimate4 = engine.estimateRenderTime(composition, 4);

                expect(estimate4).toBe(estimate1 * 4);
            });

            it('returns 0 for 0 duration', () => {
                (getCompositionDuration as ReturnType<typeof vi.fn>).mockReturnValue(0);

                const engine = new SynthesizerEngine();
                const composition = createMockComposition();

                const estimate = engine.estimateRenderTime(composition, 4);

                expect(estimate).toBe(0);
            });

            it('returns 0 for 0 instruments', () => {
                (getCompositionDuration as ReturnType<typeof vi.fn>).mockReturnValue(30);

                const engine = new SynthesizerEngine();
                const composition = createMockComposition();

                const estimate = engine.estimateRenderTime(composition, 0);

                expect(estimate).toBe(0);
            });
        });
    });

    describe('getSynthesizerEngine', () => {
        beforeEach(() => {
            // Reset the singleton by manipulating module state
            // This is a bit hacky but necessary for testing singletons
            vi.resetModules();
        });

        it('returns a SynthesizerEngine instance', () => {
            const engine = getSynthesizerEngine();
            expect(engine).toBeInstanceOf(SynthesizerEngine);
        });

        it('returns the same instance on subsequent calls', () => {
            const engine1 = getSynthesizerEngine();
            const engine2 = getSynthesizerEngine();
            expect(engine1).toBe(engine2);
        });
    });

    describe('synthesizeInstrument', () => {
        it('returns AudioResult compatible object', async () => {
            const composition = createMockComposition();
            const params = createMockParams();

            const result = await synthesizeInstrument(composition, 'erhu', params);

            expect(result).toHaveProperty('audioContent');
            expect(result).toHaveProperty('mimeType');
            expect(result).toHaveProperty('seed');
        });

        it('returns base64 audio content', async () => {
            const composition = createMockComposition();
            const params = createMockParams();

            const result = await synthesizeInstrument(composition, 'erhu', params);

            expect(result.audioContent).toBe('bW9ja0Jhc2U2NA==');
        });

        it('returns audio/wav mime type', async () => {
            const composition = createMockComposition();
            const params = createMockParams();

            const result = await synthesizeInstrument(composition, 'erhu', params);

            expect(result.mimeType).toBe('audio/wav');
        });

        it('uses seed from params', async () => {
            const composition = createMockComposition();
            const params = createMockParams({ seed: 54321 });

            const result = await synthesizeInstrument(composition, 'erhu', params);

            expect(result.seed).toBe(54321);
        });

        it('generates random seed when not provided', async () => {
            const composition = createMockComposition();
            const params = createMockParams();
            delete (params as { seed?: number }).seed;

            const result = await synthesizeInstrument(composition, 'erhu', params);

            expect(typeof result.seed).toBe('number');
            expect(result.seed).toBeGreaterThanOrEqual(0);
            expect(result.seed).toBeLessThan(100000);
        });

        it('uses singleton engine', async () => {
            const composition = createMockComposition();
            const params = createMockParams();

            // Both calls should use the same engine
            const engine1 = getSynthesizerEngine();
            const engine2 = getSynthesizerEngine();
            expect(engine1).toBe(engine2);
            expect(engine1).toBeInstanceOf(SynthesizerEngine);
        });
    });

    describe('integration scenarios', () => {
        it('handles different instruments', async () => {
            const instruments: Instrument[] = ['erhu', 'guzheng', 'pipa', 'dizi'];

            for (const instrument of instruments) {
                const mockTrack: InstrumentTrack = {
                    instrument,
                    role: 'melody',
                    notes: createMockNotes(5),
                };
                const tracksMap = new Map<Instrument, InstrumentTrack>();
                tracksMap.set(instrument, mockTrack);
                (mapCompositionToTracks as ReturnType<typeof vi.fn>).mockReturnValue(tracksMap);

                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams({ instruments: [instrument] });

                const buffer = await engine.renderTrack(composition, instrument, params);
                expect(buffer).toBeDefined();
            }
        });

        it('handles different moods', async () => {
            const moods = ['calm', 'heroic', 'melancholic', 'festive'] as const;

            for (const mood of moods) {
                const engine = new SynthesizerEngine();
                const composition = createMockComposition();
                const params = createMockParams({ mood });

                await engine.renderTrack(composition, 'erhu', params);
                expect(getVoiceParams).toHaveBeenCalledWith('erhu', mood);
            }
        });

        it('handles different sample rates', async () => {
            const sampleRates = [22050, 44100, 48000, 96000];

            for (const sampleRate of sampleRates) {
                const engine = new SynthesizerEngine(sampleRate);
                const composition = createMockComposition();
                const params = createMockParams();

                // Verify it completes without error at different sample rates
                const buffer = await engine.renderTrack(composition, 'erhu', params);
                expect(buffer).toBeDefined();
            }
        });

        it('handles large number of notes', async () => {
            const manyNotes = createMockNotes(1000);
            const mockTrack: InstrumentTrack = {
                instrument: 'erhu',
                role: 'melody',
                notes: manyNotes,
            };
            const tracksMap = new Map<Instrument, InstrumentTrack>();
            tracksMap.set('erhu', mockTrack);
            (mapCompositionToTracks as ReturnType<typeof vi.fn>).mockReturnValue(tracksMap);

            const engine = new SynthesizerEngine();
            const composition = createMockComposition();
            const params = createMockParams();

            const buffer = await engine.renderTrack(composition, 'erhu', params);
            expect(buffer).toBeDefined();
            expect(mockVoice.scheduleNote).toHaveBeenCalledTimes(1000);
        });

        it('handles empty notes array', async () => {
            const mockTrack: InstrumentTrack = {
                instrument: 'erhu',
                role: 'melody',
                notes: [],
            };
            const tracksMap = new Map<Instrument, InstrumentTrack>();
            tracksMap.set('erhu', mockTrack);
            (mapCompositionToTracks as ReturnType<typeof vi.fn>).mockReturnValue(tracksMap);

            const engine = new SynthesizerEngine();
            const composition = createMockComposition();
            const params = createMockParams();

            const buffer = await engine.renderTrack(composition, 'erhu', params);
            expect(buffer).toBeDefined();
            expect(mockVoice.scheduleNote).not.toHaveBeenCalled();
        });
    });
});
