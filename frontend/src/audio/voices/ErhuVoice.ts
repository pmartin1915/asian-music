/**
 * Erhu (二胡) - Chinese two-stringed bowed instrument.
 *
 * Characteristics:
 * - Continuous, singing tone (bowed string)
 * - Rich harmonics from sawtooth-like waveform
 * - Expressive vibrato
 * - Portamento (gliding between notes)
 * - Warm, slightly nasal timbre
 */

import { BaseVoice } from './BaseVoice';
import { applySCurvePortamento } from '../utils/envelope';
import type { ScheduledNote, VoiceParameters } from '../types';
import type { Instrument } from '../../types/music';

export class ErhuVoice extends BaseVoice {
    readonly instrument: Instrument = 'erhu';

    private lastFrequency: number = 0;
    private lastEndTime: number = 0;

    constructor(context: BaseAudioContext, params: VoiceParameters) {
        super(context, params);
    }

    scheduleNote(note: ScheduledNote, destination: AudioNode): void {
        const { frequency, startTime, duration, velocity } = note;
        const endTime = startTime + duration;

        // Main sawtooth oscillator (rich harmonics of bowed string)
        const mainOsc = this.createOscillator(frequency, 'sawtooth');

        // Sub-oscillator one octave down for body resonance
        const subOsc = this.createOscillator(frequency / 2, 'sine');

        // Mix the oscillators
        const mainGain = this.context.createGain();
        const subGain = this.context.createGain();
        mainGain.gain.value = 0.7;
        subGain.gain.value = 0.15;

        mainOsc.connect(mainGain);
        subOsc.connect(subGain);

        // Lowpass filter for warmth
        const filter = this.createLowpassFilter(
            this.params.filterCutoff || 3000,
            this.params.filterResonance || 2
        );

        // Apply portamento if close to previous note
        // Increased threshold from 0.1 to 0.2 for better slow tempo support
        const portamentoTime = this.params.portamentoTime || 0.15;
        const portamentoThreshold = 0.2;
        if (this.lastFrequency > 0 && startTime - this.lastEndTime < portamentoThreshold) {
            // Use S-curve portamento for smoother, more natural glides
            applySCurvePortamento(mainOsc.frequency, this.lastFrequency, frequency, startTime, portamentoTime);
            applySCurvePortamento(subOsc.frequency, this.lastFrequency / 2, frequency / 2, startTime, portamentoTime);
        }

        // Vibrato (increased depth for more expressive singing quality)
        const vibratoRate = this.params.vibratoRate || 5.5;
        const vibratoDepth = this.params.vibratoDepth || 30;

        // Delayed vibrato (starts after attack)
        const vibratoDelay = 0.15;
        if (duration > vibratoDelay) {
            this.applyVibrato(mainOsc, vibratoRate, vibratoDepth, startTime + vibratoDelay, duration - vibratoDelay);
        }

        // Envelope
        const envelope = this.createEnvelopedGain(note, this.envelope);

        // Connect chain: oscillators -> gains -> filter -> envelope -> destination
        mainGain.connect(filter);
        subGain.connect(filter);
        filter.connect(envelope);
        envelope.connect(this.masterGain);
        this.masterGain.connect(destination);

        // Slight filter envelope for attack brightness
        const filterPeak = Math.min((this.params.filterCutoff || 3000) * 1.5, 8000);
        filter.frequency.setValueAtTime(filterPeak, startTime);
        filter.frequency.exponentialRampToValueAtTime(
            this.params.filterCutoff || 3000,
            startTime + 0.1
        );

        // Schedule
        const stopTime = endTime + (this.envelope.release || 0.2) + 0.1;
        this.scheduleNode(mainOsc, startTime, stopTime);
        this.scheduleNode(subOsc, startTime, stopTime);

        // Track for portamento
        this.lastFrequency = frequency;
        this.lastEndTime = endTime;
    }
}
