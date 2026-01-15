/**
 * Pipa (琵琶) - Chinese four-stringed plucked lute.
 *
 * Characteristics:
 * - Percussive attack with click transient
 * - Short, punchy decay
 * - Nasal, slightly metallic timbre
 * - Tremolo technique (rapid repeated picking)
 * - Good for bass and rhythmic parts
 */

import { BaseVoice } from './BaseVoice';
import type { ScheduledNote, VoiceParameters } from '../types';
import type { Instrument } from '../../types/music';
import { applyPluckedEnvelope, applyFilterEnvelope } from '../utils/envelope';

export class PipaVoice extends BaseVoice {
    readonly instrument: Instrument = 'pipa';

    constructor(context: BaseAudioContext, params: VoiceParameters) {
        super(context, params);
    }

    scheduleNote(note: ScheduledNote, destination: AudioNode): void {
        const { frequency, startTime, duration, velocity } = note;

        // Main oscillator - square wave with reduced duty cycle for nasal quality
        // We simulate this with a combination of square and sawtooth
        const mainOsc = this.createOscillator(frequency, 'square');
        const sawOsc = this.createOscillator(frequency, 'sawtooth');

        // FM modulator for metallic attack transient
        const fmModulator = this.createOscillator(frequency * 3.5, 'sine'); // Non-integer ratio for metallic sound
        const fmGain = this.context.createGain();
        const fmDepth = this.params.fmDepth || 40; // Strong initial modulation

        // FM envelope - strong attack, quick decay for metallic transient
        fmGain.gain.setValueAtTime(fmDepth, startTime);
        fmGain.gain.exponentialRampToValueAtTime(5, startTime + 0.05); // Quick decay to subtle

        fmModulator.connect(fmGain);
        fmGain.connect(mainOsc.frequency);

        // Mix for characteristic pipa tone
        const mainGain = this.context.createGain();
        const sawGain = this.context.createGain();
        mainGain.gain.value = 0.4;
        sawGain.gain.value = 0.25;

        mainOsc.connect(mainGain);
        sawOsc.connect(sawGain);

        // Click transient for percussive attack
        const clickDuration = 0.008;
        const clickSource = this.createNoiseSource(clickDuration);
        const clickFilter = this.createBandpassFilter(3000, 4);
        const clickGain = this.context.createGain();
        clickGain.gain.setValueAtTime(velocity * 0.5, startTime);
        clickGain.gain.exponentialRampToValueAtTime(0.001, startTime + clickDuration);

        clickSource.connect(clickFilter);
        clickFilter.connect(clickGain);

        // Main filter - lowpass for warmth, highpass to remove mud
        const lowpass = this.createLowpassFilter(
            this.params.filterCutoff || 4000,
            this.params.filterResonance || 2
        );
        const highpass = this.createHighpassFilter(120, 0.7);

        // Dynamic filter envelope
        const filterPeak = (this.params.filterCutoff || 4000) * 1.5;
        applyFilterEnvelope(
            lowpass,
            this.params.filterCutoff || 4000,
            filterPeak,
            (this.params.filterCutoff || 4000) * 0.6,
            startTime,
            0.005,
            this.params.decayTime || 0.6
        );

        // Decay envelope
        const decayTime = this.params.decayTime || 0.6;
        const envelopeGain = this.context.createGain();
        applyPluckedEnvelope(envelopeGain, startTime, decayTime, velocity);

        // Optional tremolo (amplitude modulation)
        const tremoloGain = this.context.createGain();
        tremoloGain.gain.value = 1.0;

        const tremoloDepth = this.params.tremoloDepth || 0.4;
        const tremoloRate = this.params.tremoloRate || 10; // Reduced from 12Hz for smoother tremolo

        // Only apply tremolo for longer notes
        if (duration > 0.3 && tremoloDepth > 0) {
            const tremoloLFO = this.context.createOscillator();
            tremoloLFO.type = 'sine';
            tremoloLFO.frequency.value = tremoloRate;

            const tremoloLFOGain = this.context.createGain();
            tremoloLFOGain.gain.value = tremoloDepth * 0.5;

            tremoloLFO.connect(tremoloLFOGain);
            tremoloLFOGain.connect(tremoloGain.gain);

            // Fade in tremolo
            tremoloLFOGain.gain.setValueAtTime(0, startTime);
            tremoloLFOGain.gain.linearRampToValueAtTime(tremoloDepth * 0.5, startTime + 0.2);

            tremoloLFO.start(startTime);
            tremoloLFO.stop(startTime + duration + 0.5);
            this.activeNodes.add(tremoloLFO);
        }

        // Connect chain
        mainGain.connect(lowpass);
        sawGain.connect(lowpass);
        lowpass.connect(highpass);
        highpass.connect(envelopeGain);
        clickGain.connect(envelopeGain);

        envelopeGain.connect(tremoloGain);
        tremoloGain.connect(this.masterGain);
        this.masterGain.connect(destination);

        // Schedule nodes
        const stopTime = startTime + Math.max(decayTime, duration) + 0.3;
        this.scheduleNode(mainOsc, startTime, stopTime);
        this.scheduleNode(sawOsc, startTime, stopTime);
        this.scheduleNode(fmModulator, startTime, stopTime);

        clickSource.start(startTime);
        clickSource.stop(startTime + clickDuration);
        this.activeNodes.add(clickSource);
    }
}
