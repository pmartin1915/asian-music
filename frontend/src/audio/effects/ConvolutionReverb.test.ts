/**
 * Unit tests for ConvolutionReverb effect.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    generateImpulseResponse,
    createConvolutionReverb,
    createReverbChain,
    REVERB_PRESETS,
    type ReverbOptions,
    type ReverbChain,
} from './ConvolutionReverb';

// Create mock AudioContext
function createMockAudioContext(sampleRate = 44100) {
    const createMockGainNode = () => ({
        gain: {
            value: 1,
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
    });

    const createMockConvolver = () => ({
        buffer: null as AudioBuffer | null,
        connect: vi.fn(),
        disconnect: vi.fn(),
    });

    const createMockBuffer = (channels: number, length: number, rate: number) => {
        const channelData = Array.from({ length: channels }, () => new Float32Array(length));
        return {
            numberOfChannels: channels,
            length,
            sampleRate: rate,
            duration: length / rate,
            getChannelData: vi.fn((ch: number) => channelData[ch]),
        };
    };

    return {
        sampleRate,
        createGain: vi.fn(createMockGainNode),
        createConvolver: vi.fn(createMockConvolver),
        createBuffer: vi.fn((channels: number, length: number, rate: number) =>
            createMockBuffer(channels, length, rate)
        ),
    } as unknown as BaseAudioContext;
}

describe('ConvolutionReverb.ts', () => {
    let context: BaseAudioContext;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockAudioContext();
    });

    describe('generateImpulseResponse', () => {
        it('creates a stereo AudioBuffer', () => {
            const buffer = generateImpulseResponse(context);

            expect(context.createBuffer).toHaveBeenCalledWith(
                2, // stereo
                expect.any(Number),
                44100
            );
        });

        it('uses default options when none provided', () => {
            generateImpulseResponse(context);

            // Default decay time is 1.5s, room size 0.5
            // Length = sampleRate * decayTime * (0.5 + roomSize * 0.5)
            // = 44100 * 1.5 * (0.5 + 0.5 * 0.5) = 44100 * 1.5 * 0.75 = 49612.5
            const call = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(call[1]).toBeGreaterThan(40000);
            expect(call[1]).toBeLessThan(60000);
        });

        it('adjusts buffer length based on decay time', () => {
            generateImpulseResponse(context, { decayTime: 3.0 });

            const call = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls[0];
            // Longer decay = longer buffer
            expect(call[1]).toBeGreaterThan(80000);
        });

        it('adjusts buffer length based on room size', () => {
            // Small room
            generateImpulseResponse(context, { roomSize: 0.1 });
            const smallCall = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls[0];

            vi.clearAllMocks();
            context = createMockAudioContext();

            // Large room
            generateImpulseResponse(context, { roomSize: 0.9 });
            const largeCall = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls[0];

            expect(largeCall[1]).toBeGreaterThan(smallCall[1]);
        });

        it('writes to both channels', () => {
            const buffer = generateImpulseResponse(context);

            // getChannelData should be called for both channels
            expect(buffer.getChannelData).toHaveBeenCalledWith(0);
            expect(buffer.getChannelData).toHaveBeenCalledWith(1);
        });

        it('returns the created buffer', () => {
            const buffer = generateImpulseResponse(context);
            expect(buffer).toBeDefined();
            expect(buffer.numberOfChannels).toBe(2);
        });

        describe('with different options', () => {
            it('handles minimum room size (0)', () => {
                expect(() =>
                    generateImpulseResponse(context, { roomSize: 0 })
                ).not.toThrow();
            });

            it('handles maximum room size (1)', () => {
                expect(() =>
                    generateImpulseResponse(context, { roomSize: 1 })
                ).not.toThrow();
            });

            it('handles very short decay time', () => {
                expect(() =>
                    generateImpulseResponse(context, { decayTime: 0.1 })
                ).not.toThrow();
            });

            it('handles very long decay time', () => {
                expect(() =>
                    generateImpulseResponse(context, { decayTime: 5.0 })
                ).not.toThrow();
            });

            it('handles minimum damping (0)', () => {
                expect(() =>
                    generateImpulseResponse(context, { damping: 0 })
                ).not.toThrow();
            });

            it('handles maximum damping (1)', () => {
                expect(() =>
                    generateImpulseResponse(context, { damping: 1 })
                ).not.toThrow();
            });

            it('handles zero pre-delay', () => {
                expect(() =>
                    generateImpulseResponse(context, { preDelay: 0 })
                ).not.toThrow();
            });

            it('handles large pre-delay', () => {
                expect(() =>
                    generateImpulseResponse(context, { preDelay: 100 })
                ).not.toThrow();
            });
        });

        describe('with different sample rates', () => {
            it('works with 22050 Hz', () => {
                context = createMockAudioContext(22050);
                expect(() => generateImpulseResponse(context)).not.toThrow();
            });

            it('works with 48000 Hz', () => {
                context = createMockAudioContext(48000);
                expect(() => generateImpulseResponse(context)).not.toThrow();
            });

            it('works with 96000 Hz', () => {
                context = createMockAudioContext(96000);
                expect(() => generateImpulseResponse(context)).not.toThrow();
            });
        });
    });

    describe('createConvolutionReverb', () => {
        it('creates a ConvolverNode', () => {
            createConvolutionReverb(context);
            expect(context.createConvolver).toHaveBeenCalled();
        });

        it('assigns impulse response buffer to convolver', () => {
            const convolver = createConvolutionReverb(context);
            expect(convolver.buffer).toBeDefined();
        });

        it('passes options to impulse response generation', () => {
            const options: ReverbOptions = {
                roomSize: 0.8,
                decayTime: 2.0,
            };

            createConvolutionReverb(context, options);

            // Buffer length should reflect the options
            const call = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls[0];
            // 2.0 * 44100 * (0.5 + 0.8 * 0.5) = 79380
            expect(call[1]).toBeGreaterThan(70000);
        });

        it('returns the convolver node', () => {
            const convolver = createConvolutionReverb(context);
            expect(convolver).toBeDefined();
            expect(convolver.connect).toBeDefined();
        });
    });

    describe('createReverbChain', () => {
        it('creates input gain node', () => {
            createReverbChain(context);
            expect(context.createGain).toHaveBeenCalled();
        });

        it('creates output gain node', () => {
            createReverbChain(context);
            // At least 4 gain nodes: input, output, dry, wet
            expect((context.createGain as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(4);
        });

        it('creates dry and wet gain nodes', () => {
            const chain = createReverbChain(context);
            expect(chain.dryGain).toBeDefined();
            expect(chain.wetGain).toBeDefined();
        });

        it('creates convolver node', () => {
            const chain = createReverbChain(context);
            expect(chain.convolver).toBeDefined();
            expect(context.createConvolver).toHaveBeenCalled();
        });

        it('returns complete ReverbChain object', () => {
            const chain = createReverbChain(context);

            expect(chain.input).toBeDefined();
            expect(chain.output).toBeDefined();
            expect(chain.dryGain).toBeDefined();
            expect(chain.wetGain).toBeDefined();
            expect(chain.convolver).toBeDefined();
            expect(chain.setMix).toBeDefined();
        });

        describe('connections', () => {
            it('connects input to dry gain', () => {
                const chain = createReverbChain(context);
                expect(chain.input.connect).toHaveBeenCalledWith(chain.dryGain);
            });

            it('connects dry gain to output', () => {
                const chain = createReverbChain(context);
                expect(chain.dryGain.connect).toHaveBeenCalledWith(chain.output);
            });

            it('connects input to convolver', () => {
                const chain = createReverbChain(context);
                expect(chain.input.connect).toHaveBeenCalledWith(chain.convolver);
            });

            it('connects convolver to wet gain', () => {
                const chain = createReverbChain(context);
                expect(chain.convolver.connect).toHaveBeenCalledWith(chain.wetGain);
            });

            it('connects wet gain to output', () => {
                const chain = createReverbChain(context);
                expect(chain.wetGain.connect).toHaveBeenCalledWith(chain.output);
            });
        });

        describe('mix levels', () => {
            it('sets default mix at 0.3', () => {
                const chain = createReverbChain(context);
                expect(chain.dryGain.gain.value).toBe(0.7); // 1 - 0.3
                expect(chain.wetGain.gain.value).toBe(0.3);
            });

            it('respects custom mix option', () => {
                const chain = createReverbChain(context, { mix: 0.5 });
                expect(chain.dryGain.gain.value).toBe(0.5);
                expect(chain.wetGain.gain.value).toBe(0.5);
            });

            it('handles mix at 0 (fully dry)', () => {
                const chain = createReverbChain(context, { mix: 0 });
                expect(chain.dryGain.gain.value).toBe(1);
                expect(chain.wetGain.gain.value).toBe(0);
            });

            it('handles mix at 1 (fully wet)', () => {
                const chain = createReverbChain(context, { mix: 1 });
                expect(chain.dryGain.gain.value).toBe(0);
                expect(chain.wetGain.gain.value).toBe(1);
            });
        });

        describe('setMix function', () => {
            it('updates dry and wet gain values', () => {
                const chain = createReverbChain(context);

                chain.setMix(0.6);

                expect(chain.dryGain.gain.value).toBe(0.4);
                expect(chain.wetGain.gain.value).toBe(0.6);
            });

            it('clamps mix below 0 to 0', () => {
                const chain = createReverbChain(context);

                chain.setMix(-0.5);

                expect(chain.dryGain.gain.value).toBe(1);
                expect(chain.wetGain.gain.value).toBe(0);
            });

            it('clamps mix above 1 to 1', () => {
                const chain = createReverbChain(context);

                chain.setMix(1.5);

                expect(chain.dryGain.gain.value).toBe(0);
                expect(chain.wetGain.gain.value).toBe(1);
            });

            it('handles multiple setMix calls', () => {
                const chain = createReverbChain(context);

                chain.setMix(0.2);
                expect(chain.wetGain.gain.value).toBe(0.2);

                chain.setMix(0.8);
                expect(chain.wetGain.gain.value).toBe(0.8);

                chain.setMix(0.5);
                expect(chain.wetGain.gain.value).toBe(0.5);
            });
        });
    });

    describe('REVERB_PRESETS', () => {
        it('has calm preset', () => {
            expect(REVERB_PRESETS.calm).toBeDefined();
        });

        it('has heroic preset', () => {
            expect(REVERB_PRESETS.heroic).toBeDefined();
        });

        it('has melancholic preset', () => {
            expect(REVERB_PRESETS.melancholic).toBeDefined();
        });

        it('has festive preset', () => {
            expect(REVERB_PRESETS.festive).toBeDefined();
        });

        describe('calm preset', () => {
            it('has larger room size', () => {
                expect(REVERB_PRESETS.calm.roomSize).toBeGreaterThan(0.5);
            });

            it('has longer decay time', () => {
                expect(REVERB_PRESETS.calm.decayTime).toBeGreaterThan(1.5);
            });

            it('has moderate damping', () => {
                expect(REVERB_PRESETS.calm.damping).toBeGreaterThan(0.3);
                expect(REVERB_PRESETS.calm.damping).toBeLessThan(0.6);
            });

            it('has higher mix level', () => {
                expect(REVERB_PRESETS.calm.mix).toBeGreaterThan(0.3);
            });
        });

        describe('heroic preset', () => {
            it('has medium room size', () => {
                expect(REVERB_PRESETS.heroic.roomSize).toBe(0.5);
            });

            it('has shorter decay time', () => {
                expect(REVERB_PRESETS.heroic.decayTime).toBeLessThan(1.5);
            });

            it('has lower mix level', () => {
                expect(REVERB_PRESETS.heroic.mix).toBeLessThan(0.3);
            });
        });

        describe('melancholic preset', () => {
            it('has large room size', () => {
                expect(REVERB_PRESETS.melancholic.roomSize).toBeGreaterThan(0.7);
            });

            it('has long decay time', () => {
                expect(REVERB_PRESETS.melancholic.decayTime).toBeGreaterThan(2.0);
            });

            it('has higher damping (darker)', () => {
                expect(REVERB_PRESETS.melancholic.damping).toBeGreaterThan(0.5);
            });

            it('has highest mix level', () => {
                expect(REVERB_PRESETS.melancholic.mix).toBeGreaterThan(0.35);
            });
        });

        describe('festive preset', () => {
            it('has smaller room size', () => {
                expect(REVERB_PRESETS.festive.roomSize).toBeLessThan(0.5);
            });

            it('has short decay time', () => {
                expect(REVERB_PRESETS.festive.decayTime).toBeLessThanOrEqual(1.0);
            });

            it('has low damping (brighter)', () => {
                expect(REVERB_PRESETS.festive.damping).toBeLessThan(0.3);
            });

            it('has shorter pre-delay', () => {
                expect(REVERB_PRESETS.festive.preDelay).toBeLessThan(20);
            });
        });

        it('all presets have valid room size (0-1)', () => {
            Object.values(REVERB_PRESETS).forEach(preset => {
                expect(preset.roomSize).toBeGreaterThanOrEqual(0);
                expect(preset.roomSize).toBeLessThanOrEqual(1);
            });
        });

        it('all presets have valid damping (0-1)', () => {
            Object.values(REVERB_PRESETS).forEach(preset => {
                expect(preset.damping).toBeGreaterThanOrEqual(0);
                expect(preset.damping).toBeLessThanOrEqual(1);
            });
        });

        it('all presets have valid mix (0-1)', () => {
            Object.values(REVERB_PRESETS).forEach(preset => {
                expect(preset.mix).toBeGreaterThanOrEqual(0);
                expect(preset.mix).toBeLessThanOrEqual(1);
            });
        });

        it('all presets have positive decay time', () => {
            Object.values(REVERB_PRESETS).forEach(preset => {
                expect(preset.decayTime).toBeGreaterThan(0);
            });
        });

        it('all presets have non-negative pre-delay', () => {
            Object.values(REVERB_PRESETS).forEach(preset => {
                expect(preset.preDelay).toBeGreaterThanOrEqual(0);
            });
        });

        it('can be used with createReverbChain', () => {
            Object.entries(REVERB_PRESETS).forEach(([name, preset]) => {
                vi.clearAllMocks();
                context = createMockAudioContext();

                expect(() => {
                    createReverbChain(context, preset);
                }).not.toThrow();
            });
        });

        it('can be used with createConvolutionReverb', () => {
            Object.entries(REVERB_PRESETS).forEach(([name, preset]) => {
                vi.clearAllMocks();
                context = createMockAudioContext();

                expect(() => {
                    createConvolutionReverb(context, preset);
                }).not.toThrow();
            });
        });
    });

    describe('integration scenarios', () => {
        it('creates different IR for different options', () => {
            const options1: ReverbOptions = { roomSize: 0.2, decayTime: 0.5 };
            const options2: ReverbOptions = { roomSize: 0.8, decayTime: 3.0 };

            generateImpulseResponse(context, options1);
            const call1 = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls[0];

            vi.clearAllMocks();
            context = createMockAudioContext();

            generateImpulseResponse(context, options2);
            const call2 = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls[0];

            // Different options should produce different buffer lengths
            expect(call1[1]).not.toBe(call2[1]);
        });

        it('complete reverb chain workflow', () => {
            // Create chain
            const chain = createReverbChain(context, REVERB_PRESETS.calm);

            // Verify structure
            expect(chain.input).toBeDefined();
            expect(chain.output).toBeDefined();

            // Adjust mix dynamically
            chain.setMix(0.5);
            expect(chain.wetGain.gain.value).toBe(0.5);

            // Could connect to audio graph (mocked)
            const mockDestination = {} as AudioNode;
            expect(() => chain.output.connect(mockDestination)).not.toThrow();
        });

        it('handles rapid option changes', () => {
            for (let i = 0; i < 10; i++) {
                vi.clearAllMocks();
                context = createMockAudioContext();

                const options: ReverbOptions = {
                    roomSize: Math.random(),
                    decayTime: 0.5 + Math.random() * 3,
                    damping: Math.random(),
                    preDelay: Math.random() * 100,
                    mix: Math.random(),
                };

                expect(() => createReverbChain(context, options)).not.toThrow();
            }
        });
    });
});
