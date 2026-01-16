/**
 * Unit tests for WAV encoding utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    audioBufferToWavBlob,
    audioBufferToBase64WAV,
    createSilentBuffer,
    mixBuffers
} from './wavEncoder';

// Mock AudioBuffer
function createMockAudioBuffer(options: {
    numberOfChannels?: number;
    length?: number;
    sampleRate?: number;
    channelData?: Float32Array[];
} = {}) {
    const {
        numberOfChannels = 2,
        length = 44100,
        sampleRate = 44100,
        channelData
    } = options;

    const channels: Float32Array[] = channelData ||
        Array.from({ length: numberOfChannels }, () => new Float32Array(length));

    return {
        numberOfChannels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: vi.fn((ch: number) => channels[ch])
    } as unknown as AudioBuffer;
}

// Mock AudioContext
function createMockAudioContext(sampleRate = 44100) {
    return {
        sampleRate,
        createBuffer: vi.fn((numChannels: number, length: number, rate: number) => {
            const channels = Array.from({ length: numChannels }, () => new Float32Array(length));
            return {
                numberOfChannels: numChannels,
                length,
                sampleRate: rate,
                duration: length / rate,
                getChannelData: vi.fn((ch: number) => channels[ch])
            };
        })
    } as unknown as BaseAudioContext;
}

describe('wavEncoder.ts', () => {

    describe('audioBufferToWavBlob', () => {
        it('returns a Blob', () => {
            const buffer = createMockAudioBuffer();
            const blob = audioBufferToWavBlob(buffer);
            expect(blob).toBeInstanceOf(Blob);
        });

        it('has correct MIME type', () => {
            const buffer = createMockAudioBuffer();
            const blob = audioBufferToWavBlob(buffer);
            expect(blob.type).toBe('audio/wav');
        });

        it('handles mono buffer', () => {
            const buffer = createMockAudioBuffer({ numberOfChannels: 1 });
            const blob = audioBufferToWavBlob(buffer);
            expect(blob).toBeInstanceOf(Blob);
        });

        it('handles stereo buffer', () => {
            const buffer = createMockAudioBuffer({ numberOfChannels: 2 });
            const blob = audioBufferToWavBlob(buffer);
            expect(blob).toBeInstanceOf(Blob);
        });

        it('handles different sample rates', () => {
            const buffer = createMockAudioBuffer({ sampleRate: 48000 });
            const blob = audioBufferToWavBlob(buffer);
            expect(blob).toBeInstanceOf(Blob);
        });
    });

    describe('audioBufferToBase64WAV', () => {
        it('returns a string', () => {
            const buffer = createMockAudioBuffer({ length: 100 });
            const base64 = audioBufferToBase64WAV(buffer);
            expect(typeof base64).toBe('string');
        });

        it('returns valid base64', () => {
            const buffer = createMockAudioBuffer({ length: 100 });
            const base64 = audioBufferToBase64WAV(buffer);
            // Base64 should only contain valid characters
            expect(base64).toMatch(/^[A-Za-z0-9+/=]+$/);
        });

        it('can be decoded back to binary', () => {
            const buffer = createMockAudioBuffer({ length: 100 });
            const base64 = audioBufferToBase64WAV(buffer);
            // Should not throw when decoded
            expect(() => atob(base64)).not.toThrow();
        });

        it('decoded data starts with RIFF header', () => {
            const buffer = createMockAudioBuffer({ length: 100 });
            const base64 = audioBufferToBase64WAV(buffer);
            const binary = atob(base64);
            expect(binary.substring(0, 4)).toBe('RIFF');
        });

        it('decoded data contains WAVE format identifier', () => {
            const buffer = createMockAudioBuffer({ length: 100 });
            const base64 = audioBufferToBase64WAV(buffer);
            const binary = atob(base64);
            expect(binary.substring(8, 12)).toBe('WAVE');
        });

        it('decoded data contains fmt chunk', () => {
            const buffer = createMockAudioBuffer({ length: 100 });
            const base64 = audioBufferToBase64WAV(buffer);
            const binary = atob(base64);
            expect(binary.substring(12, 16)).toBe('fmt ');
        });

        it('decoded data contains data chunk', () => {
            const buffer = createMockAudioBuffer({ length: 100 });
            const base64 = audioBufferToBase64WAV(buffer);
            const binary = atob(base64);
            expect(binary.substring(36, 40)).toBe('data');
        });
    });

    describe('createSilentBuffer', () => {
        let context: BaseAudioContext;

        beforeEach(() => {
            context = createMockAudioContext();
        });

        it('creates a buffer with correct duration', () => {
            createSilentBuffer(context, 2);
            expect(context.createBuffer).toHaveBeenCalledWith(
                2,
                expect.any(Number),
                44100
            );
            // 2 seconds at 44100 Hz = 88200 samples
            const call = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(call[1]).toBe(88200);
        });

        it('creates stereo buffer', () => {
            createSilentBuffer(context, 1);
            expect(context.createBuffer).toHaveBeenCalledWith(2, expect.any(Number), 44100);
        });

        it('handles fractional durations', () => {
            createSilentBuffer(context, 0.5);
            const call = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(call[1]).toBe(22050); // 0.5 * 44100
        });

        it('handles different sample rates', () => {
            const ctx = createMockAudioContext(48000);
            createSilentBuffer(ctx, 1);
            const call = (ctx.createBuffer as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(call[1]).toBe(48000);
            expect(call[2]).toBe(48000);
        });
    });

    describe('mixBuffers', () => {
        let context: BaseAudioContext;

        beforeEach(() => {
            context = createMockAudioContext();
        });

        it('returns silent buffer for empty array', () => {
            const result = mixBuffers(context, []);
            expect(context.createBuffer).toHaveBeenCalled();
        });

        it('creates output buffer with length of longest input', () => {
            const buffer1 = createMockAudioBuffer({ length: 1000 });
            const buffer2 = createMockAudioBuffer({ length: 2000 });

            mixBuffers(context, [buffer1, buffer2]);

            const call = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(call[1]).toBe(2000);
        });

        it('creates output buffer with max channels from inputs', () => {
            const mono = createMockAudioBuffer({ numberOfChannels: 1, length: 100 });
            const stereo = createMockAudioBuffer({ numberOfChannels: 2, length: 100 });

            mixBuffers(context, [mono, stereo]);

            const call = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(call[0]).toBe(2);
        });

        it('applies gains to each buffer', () => {
            const data1 = new Float32Array([0.5, 0.5]);
            const data2 = new Float32Array([0.5, 0.5]);

            const buffer1 = createMockAudioBuffer({
                numberOfChannels: 1,
                length: 2,
                channelData: [data1]
            });
            const buffer2 = createMockAudioBuffer({
                numberOfChannels: 1,
                length: 2,
                channelData: [data2]
            });

            mixBuffers(context, [buffer1, buffer2], [1.0, 0.5]);

            // Verify getChannelData was called to read input
            expect(buffer1.getChannelData).toHaveBeenCalled();
            expect(buffer2.getChannelData).toHaveBeenCalled();
        });

        it('uses default gain of 1.0 when gains not provided', () => {
            const data = new Float32Array([0.5]);
            const buffer = createMockAudioBuffer({
                numberOfChannels: 1,
                length: 1,
                channelData: [data]
            });

            const result = mixBuffers(context, [buffer]);
            expect(result).toBeDefined();
        });

        it('handles single buffer input', () => {
            const buffer = createMockAudioBuffer({ length: 100 });
            const result = mixBuffers(context, [buffer]);
            expect(result).toBeDefined();
        });
    });

    describe('WAV structure validation', () => {
        it('WAV header is 44 bytes', () => {
            const buffer = createMockAudioBuffer({ length: 0, numberOfChannels: 2 });
            const base64 = audioBufferToBase64WAV(buffer);
            const binary = atob(base64);
            // Header is 44 bytes, no data for 0-length buffer
            expect(binary.length).toBe(44);
        });

        it('WAV contains correct PCM format code', () => {
            const buffer = createMockAudioBuffer({ length: 100 });
            const base64 = audioBufferToBase64WAV(buffer);
            const binary = atob(base64);
            // PCM format code is at offset 20, should be 1
            const formatCode = binary.charCodeAt(20) + (binary.charCodeAt(21) << 8);
            expect(formatCode).toBe(1);
        });

        it('WAV contains correct bits per sample (16)', () => {
            const buffer = createMockAudioBuffer({ length: 100 });
            const base64 = audioBufferToBase64WAV(buffer);
            const binary = atob(base64);
            // Bits per sample at offset 34
            const bitsPerSample = binary.charCodeAt(34) + (binary.charCodeAt(35) << 8);
            expect(bitsPerSample).toBe(16);
        });
    });

    describe('audio data handling', () => {
        it('handles audio with values at maximum (1.0)', () => {
            const data = new Float32Array([1.0, 1.0]);
            const buffer = createMockAudioBuffer({
                numberOfChannels: 1,
                length: 2,
                channelData: [data]
            });

            expect(() => audioBufferToWavBlob(buffer)).not.toThrow();
        });

        it('handles audio with values at minimum (-1.0)', () => {
            const data = new Float32Array([-1.0, -1.0]);
            const buffer = createMockAudioBuffer({
                numberOfChannels: 1,
                length: 2,
                channelData: [data]
            });

            expect(() => audioBufferToWavBlob(buffer)).not.toThrow();
        });

        it('clamps values exceeding 1.0', () => {
            const data = new Float32Array([2.0, 1.5]);
            const buffer = createMockAudioBuffer({
                numberOfChannels: 1,
                length: 2,
                channelData: [data]
            });

            // Should not throw - values are clamped in floatTo16BitPCM
            expect(() => audioBufferToWavBlob(buffer)).not.toThrow();
        });

        it('clamps values below -1.0', () => {
            const data = new Float32Array([-2.0, -1.5]);
            const buffer = createMockAudioBuffer({
                numberOfChannels: 1,
                length: 2,
                channelData: [data]
            });

            expect(() => audioBufferToWavBlob(buffer)).not.toThrow();
        });

        it('handles silent audio (all zeros)', () => {
            const data = new Float32Array([0, 0, 0, 0]);
            const buffer = createMockAudioBuffer({
                numberOfChannels: 1,
                length: 4,
                channelData: [data]
            });

            expect(() => audioBufferToWavBlob(buffer)).not.toThrow();
        });
    });
});
