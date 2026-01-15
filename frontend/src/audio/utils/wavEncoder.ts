/**
 * WAV audio encoding utilities.
 * Converts AudioBuffer to WAV format for compatibility with existing playback.
 */

/**
 * Convert an AudioBuffer to a WAV Blob.
 *
 * @param buffer - The AudioBuffer to convert
 * @returns A Blob containing WAV audio data
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const wavData = encodeWAV(buffer);
    return new Blob([wavData], { type: 'audio/wav' });
}

/**
 * Convert an AudioBuffer to a base64-encoded WAV string.
 *
 * @param buffer - The AudioBuffer to convert
 * @returns Base64-encoded WAV data
 */
export function audioBufferToBase64WAV(buffer: AudioBuffer): string {
    const wavData = encodeWAV(buffer);
    return arrayBufferToBase64(wavData);
}

/**
 * Encode an AudioBuffer as WAV format.
 *
 * @param buffer - The AudioBuffer to encode
 * @returns ArrayBuffer containing WAV data
 */
function encodeWAV(buffer: AudioBuffer): ArrayBuffer {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;

    // Interleave channels
    const interleaved = interleaveChannels(buffer);
    const dataLength = interleaved.length * bytesPerSample;

    // WAV file structure:
    // RIFF header (12 bytes)
    // fmt  chunk (24 bytes)
    // data chunk (8 bytes + data)
    const headerLength = 44;
    const totalLength = headerLength + dataLength;

    const arrayBuffer = new ArrayBuffer(totalLength);
    const view = new DataView(arrayBuffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, totalLength - 8, true); // File size - 8
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);             // Chunk size (16 for PCM)
    view.setUint16(20, 1, true);              // Audio format (1 = PCM)
    view.setUint16(22, numChannels, true);    // Number of channels
    view.setUint32(24, sampleRate, true);     // Sample rate
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // Byte rate
    view.setUint16(32, numChannels * bytesPerSample, true); // Block align
    view.setUint16(34, bitsPerSample, true);  // Bits per sample

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);     // Data size

    // Write audio data
    floatTo16BitPCM(view, 44, interleaved);

    return arrayBuffer;
}

/**
 * Interleave audio channels into a single array.
 * For stereo: [L0, R0, L1, R1, L2, R2, ...]
 */
function interleaveChannels(buffer: AudioBuffer): Float32Array {
    const numChannels = buffer.numberOfChannels;
    const length = buffer.length;
    const result = new Float32Array(length * numChannels);

    // Get all channel data
    const channels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
        channels.push(buffer.getChannelData(ch));
    }

    // Interleave
    for (let i = 0; i < length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            result[i * numChannels + ch] = channels[ch][i];
        }
    }

    return result;
}

/**
 * Write a string to a DataView.
 */
function writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

/**
 * Convert float samples to 16-bit PCM and write to DataView.
 */
function floatTo16BitPCM(view: DataView, offset: number, samples: Float32Array): void {
    for (let i = 0; i < samples.length; i++) {
        // Clamp to [-1, 1]
        const s = Math.max(-1, Math.min(1, samples[i]));
        // Convert to 16-bit signed integer
        const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(offset + i * 2, val, true);
    }
}

/**
 * Convert an ArrayBuffer to base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000; // Process in chunks to avoid call stack size exceeded

    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
    }

    return btoa(binary);
}

/**
 * Create a silent AudioBuffer.
 *
 * @param context - AudioContext or OfflineAudioContext
 * @param duration - Duration in seconds
 * @returns Silent AudioBuffer
 */
export function createSilentBuffer(
    context: BaseAudioContext,
    duration: number
): AudioBuffer {
    const sampleRate = context.sampleRate;
    const length = Math.ceil(duration * sampleRate);
    return context.createBuffer(2, length, sampleRate);
}

/**
 * Mix multiple AudioBuffers into one (simple summing).
 *
 * @param context - AudioContext or OfflineAudioContext
 * @param buffers - Array of AudioBuffers to mix
 * @param gains - Optional gain for each buffer (defaults to 1.0)
 * @returns Mixed AudioBuffer
 */
export function mixBuffers(
    context: BaseAudioContext,
    buffers: AudioBuffer[],
    gains?: number[]
): AudioBuffer {
    if (buffers.length === 0) {
        return createSilentBuffer(context, 1);
    }

    // Find the longest buffer
    const maxLength = Math.max(...buffers.map(b => b.length));
    const sampleRate = buffers[0].sampleRate;
    const numChannels = Math.max(...buffers.map(b => b.numberOfChannels));

    const output = context.createBuffer(numChannels, maxLength, sampleRate);

    for (let ch = 0; ch < numChannels; ch++) {
        const outputData = output.getChannelData(ch);

        buffers.forEach((buffer, idx) => {
            const gain = gains?.[idx] ?? 1.0;
            const channelIdx = Math.min(ch, buffer.numberOfChannels - 1);
            const inputData = buffer.getChannelData(channelIdx);

            for (let i = 0; i < inputData.length; i++) {
                outputData[i] += inputData[i] * gain;
            }
        });
    }

    // Normalize to prevent clipping
    normalizeBuffer(output);

    return output;
}

/**
 * Normalize an AudioBuffer to prevent clipping.
 */
function normalizeBuffer(buffer: AudioBuffer): void {
    let maxSample = 0;

    // Find peak
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
            maxSample = Math.max(maxSample, Math.abs(data[i]));
        }
    }

    // Normalize if peak > 1
    if (maxSample > 1) {
        const scale = 0.95 / maxSample;
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = 0; i < data.length; i++) {
                data[i] *= scale;
            }
        }
    }
}
