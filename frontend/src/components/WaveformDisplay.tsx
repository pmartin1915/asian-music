import React, { useRef, useEffect, useCallback } from 'react';

interface WaveformDisplayProps {
    audioData: Float32Array | null;
    currentTime: number;
    duration: number;
    width?: number;
    height?: number;
    waveColor?: string;
    progressColor?: string;
    backgroundColor?: string;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
    audioData,
    currentTime,
    duration,
    width = 600,
    height = 80,
    waveColor = '#D4A574', // silk-amber
    progressColor = '#C41E3A', // silk-red
    backgroundColor = '#f5f5f4', // stone-100
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const drawWaveform = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !audioData) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // Calculate progress position
        const progressX = duration > 0 ? (currentTime / duration) * width : 0;

        // Downsample audio data to fit canvas width
        const samplesPerPixel = Math.floor(audioData.length / width);
        const centerY = height / 2;
        const amplitude = height * 0.45;

        // Draw waveform
        for (let x = 0; x < width; x++) {
            const startSample = x * samplesPerPixel;
            const endSample = Math.min(startSample + samplesPerPixel, audioData.length);

            // Find min and max in this pixel's sample range
            let min = 0;
            let max = 0;
            for (let i = startSample; i < endSample; i++) {
                const sample = audioData[i];
                if (sample < min) min = sample;
                if (sample > max) max = sample;
            }

            // Draw vertical line from min to max
            const yMin = centerY - max * amplitude;
            const yMax = centerY - min * amplitude;

            ctx.fillStyle = x < progressX ? progressColor : waveColor;
            ctx.fillRect(x, yMin, 1, Math.max(1, yMax - yMin));
        }

        // Draw playhead line
        if (progressX > 0) {
            ctx.strokeStyle = progressColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(progressX, 0);
            ctx.lineTo(progressX, height);
            ctx.stroke();
        }
    }, [audioData, currentTime, duration, width, height, waveColor, progressColor, backgroundColor]);

    useEffect(() => {
        drawWaveform();
    }, [drawWaveform]);

    if (!audioData) {
        return null;
    }

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="rounded-lg"
            role="img"
            aria-label="Audio waveform visualization"
        />
    );
};

/**
 * Extract waveform data from an AudioBuffer.
 * Returns a Float32Array with peak values for visualization.
 */
export function extractWaveformData(audioBuffer: AudioBuffer): Float32Array {
    // Mix all channels to mono
    const channelCount = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const mixed = new Float32Array(length);

    for (let channel = 0; channel < channelCount; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            mixed[i] += channelData[i] / channelCount;
        }
    }

    return mixed;
}

/**
 * Decode base64 audio and extract waveform data.
 */
export async function decodeAndExtractWaveform(
    base64Audio: string,
    audioContext: AudioContext
): Promise<Float32Array> {
    // Decode base64 to ArrayBuffer
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Decode audio
    const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
    return extractWaveformData(audioBuffer);
}
