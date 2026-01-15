/**
 * Main synthesizer engine that orchestrates audio generation.
 * Renders instrument tracks to AudioBuffers using OfflineAudioContext.
 */

import type { Composition, Instrument, CompositionParams } from '../types/music';
import type { InstrumentTrack, SynthesizerConfig, RenderResult } from './types';
import { DEFAULT_SAMPLE_RATE, NUM_CHANNELS, SECTION_DURATION } from './types';
import { mapCompositionToTracks, getCompositionDuration } from './scheduling';
import { createVoice } from './voices';
import { getVoiceParams, INSTRUMENT_GAIN } from './utils/moodParams';
import { audioBufferToBase64WAV } from './utils/wavEncoder';

/**
 * Progress callback for rendering status.
 */
export type RenderProgressCallback = (progress: number, instrument: Instrument) => void;

/**
 * Main synthesizer engine class.
 */
export class SynthesizerEngine {
    private sampleRate: number;

    constructor(sampleRate: number = DEFAULT_SAMPLE_RATE) {
        this.sampleRate = sampleRate;
    }

    /**
     * Render a single instrument track to an AudioBuffer.
     *
     * @param composition - Composition data from Gemini
     * @param instrument - Which instrument to render
     * @param params - Original composition parameters
     * @param onProgress - Optional progress callback
     * @returns AudioBuffer containing the rendered track
     */
    async renderTrack(
        composition: Composition,
        instrument: Instrument,
        params: CompositionParams,
        onProgress?: RenderProgressCallback
    ): Promise<AudioBuffer> {
        const duration = getCompositionDuration(composition);

        // Create offline context for rendering
        const offlineCtx = new OfflineAudioContext({
            numberOfChannels: NUM_CHANNELS,
            length: Math.ceil(duration * this.sampleRate) + this.sampleRate, // +1s buffer
            sampleRate: this.sampleRate,
        });

        // Get voice parameters for this instrument and mood
        const voiceParams = getVoiceParams(instrument, params.mood);

        // Create voice
        const voice = createVoice(instrument, offlineCtx, voiceParams);

        // Map composition to notes for this instrument
        const tracks = mapCompositionToTracks(composition, {
            ...params,
            instruments: [instrument], // Only this instrument
        });

        const track = tracks.get(instrument);
        if (!track) {
            throw new Error(`Failed to generate track for ${instrument}`);
        }

        // Create master gain with instrument-specific level
        const masterGain = offlineCtx.createGain();
        masterGain.gain.value = INSTRUMENT_GAIN[instrument] || 0.7;
        masterGain.connect(offlineCtx.destination);

        // Schedule all notes
        onProgress?.(0.1, instrument);

        for (let i = 0; i < track.notes.length; i++) {
            voice.scheduleNote(track.notes[i], masterGain);

            // Report progress periodically
            if (i % 50 === 0) {
                onProgress?.(0.1 + (0.7 * i / track.notes.length), instrument);
            }
        }

        onProgress?.(0.8, instrument);

        // Render
        const buffer = await offlineCtx.startRendering();

        // Cleanup
        voice.dispose();

        onProgress?.(1.0, instrument);

        return buffer;
    }

    /**
     * Render a track and return base64 WAV (compatible with existing AudioResult).
     *
     * @param composition - Composition data
     * @param instrument - Instrument to render
     * @param params - Composition parameters
     * @param onProgress - Optional progress callback
     * @returns Base64-encoded WAV audio
     */
    async renderTrackToBase64(
        composition: Composition,
        instrument: Instrument,
        params: CompositionParams,
        onProgress?: RenderProgressCallback
    ): Promise<string> {
        const buffer = await this.renderTrack(composition, instrument, params, onProgress);
        return audioBufferToBase64WAV(buffer);
    }

    /**
     * Render all instruments and return results.
     *
     * @param composition - Composition data
     * @param params - Composition parameters
     * @param onProgress - Progress callback (0-1 per instrument)
     * @returns Map of instrument to render results
     */
    async renderAll(
        composition: Composition,
        params: CompositionParams,
        onProgress?: (instrument: Instrument, progress: number) => void
    ): Promise<Map<Instrument, RenderResult>> {
        const results = new Map<Instrument, RenderResult>();
        const duration = getCompositionDuration(composition);

        for (const instrument of params.instruments) {
            const buffer = await this.renderTrack(
                composition,
                instrument,
                params,
                (progress) => onProgress?.(instrument, progress)
            );

            results.set(instrument, {
                buffer,
                duration,
                instrument,
            });
        }

        return results;
    }

    /**
     * Get estimated render time (rough approximation).
     */
    estimateRenderTime(composition: Composition, instrumentCount: number): number {
        const duration = getCompositionDuration(composition);
        // Rough estimate: 0.5s processing per second of audio per instrument
        return duration * 0.5 * instrumentCount;
    }
}

/**
 * Singleton instance for convenience.
 */
let defaultEngine: SynthesizerEngine | null = null;

/**
 * Get the default synthesizer engine instance.
 */
export function getSynthesizerEngine(): SynthesizerEngine {
    if (!defaultEngine) {
        defaultEngine = new SynthesizerEngine();
    }
    return defaultEngine;
}

/**
 * Synthesize audio for a single instrument.
 * Drop-in replacement for the API generateAudio function.
 *
 * @param composition - Composition data from Gemini
 * @param instrument - Instrument to synthesize
 * @param params - Composition parameters
 * @returns AudioResult compatible with existing code
 */
export async function synthesizeInstrument(
    composition: Composition,
    instrument: Instrument,
    params: CompositionParams
): Promise<{ audioContent: string; mimeType: string; seed: number }> {
    const engine = getSynthesizerEngine();
    const audioContent = await engine.renderTrackToBase64(composition, instrument, params);

    return {
        audioContent,
        mimeType: 'audio/wav',
        seed: params.seed || Math.floor(Math.random() * 100000),
    };
}
