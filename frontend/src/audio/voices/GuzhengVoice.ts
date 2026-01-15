/**
 * Guzheng (古筝) - Chinese plucked zither.
 *
 * Characteristics:
 * - Bright, resonant plucked tone
 * - Long sustain with natural decay
 * - Sympathetic string resonance
 * - Crisp attack transient
 * - Wide frequency range
 */

import { BaseVoice } from './BaseVoice';
import type { ScheduledNote, VoiceParameters } from '../types';
import type { Instrument } from '../../types/music';
import { applyPluckedEnvelope, applyFilterEnvelope } from '../utils/envelope';

export class GuzhengVoice extends BaseVoice {
    readonly instrument: Instrument = 'guzheng';

    constructor(context: BaseAudioContext, params: VoiceParameters) {
        super(context, params);
    }

    scheduleNote(note: ScheduledNote, destination: AudioNode): void {
        const { frequency, startTime, duration, velocity } = note;

        // Main triangle oscillator (cleaner harmonics for plucked)
        const mainOsc = this.createOscillator(frequency, 'triangle');

        // Second harmonic for brightness
        const harmonic2 = this.createOscillator(frequency * 2, 'sine');

        // Mix oscillators
        const mainGain = this.context.createGain();
        const harmonic2Gain = this.context.createGain();
        mainGain.gain.value = 0.6;
        harmonic2Gain.gain.value = 0.15;

        mainOsc.connect(mainGain);
        harmonic2.connect(harmonic2Gain);

        // Pluck transient (short noise burst)
        const transientDuration = 0.02;
        const noiseSource = this.createNoiseSource(transientDuration);
        const noiseFilter = this.createBandpassFilter(frequency * 3, 2);
        const noiseGain = this.context.createGain();
        noiseGain.gain.setValueAtTime(velocity * 0.3, startTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + transientDuration);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);

        // Main filter for tone shaping
        const brightness = this.params.brightness || 0.6;
        const filterCutoff = (this.params.filterCutoff || 6000) * brightness;
        const filter = this.createLowpassFilter(filterCutoff, this.params.filterResonance || 1.5);

        // Dynamic filter envelope (opens on attack, closes during decay)
        const filterPeak = Math.min(filterCutoff * 2, 12000);
        applyFilterEnvelope(
            filter,
            filterCutoff,    // start
            filterPeak,      // peak
            filterCutoff * 0.5, // end
            startTime,
            0.01,            // attack time
            this.params.decayTime || 2.0 // decay time
        );

        // Plucked envelope with natural decay (increased for fuller resonance)
        const decayTime = this.params.decayTime || 2.5;
        const envelopeGain = this.context.createGain();
        applyPluckedEnvelope(envelopeGain, startTime, decayTime, velocity);

        // Sympathetic resonance simulation using comb filter effect
        const delayNode = this.context.createDelay(0.1);
        const resonanceGain = this.context.createGain();
        const feedbackGain = this.context.createGain();

        // Delay time based on frequency (creates harmonic resonance)
        const delayTime = Math.min(1 / frequency * 2, 0.05);
        delayNode.delayTime.value = delayTime;
        resonanceGain.gain.value = 0.15;
        feedbackGain.gain.value = 0.3;

        // Connect chain
        mainGain.connect(filter);
        harmonic2Gain.connect(filter);
        noiseGain.connect(envelopeGain);

        filter.connect(envelopeGain);

        // Resonance feedback loop
        envelopeGain.connect(delayNode);
        delayNode.connect(feedbackGain);
        feedbackGain.connect(delayNode); // feedback
        delayNode.connect(resonanceGain);

        // Output
        envelopeGain.connect(this.masterGain);
        resonanceGain.connect(this.masterGain);
        this.masterGain.connect(destination);

        // Schedule nodes
        const stopTime = startTime + decayTime + 0.5;
        this.scheduleNode(mainOsc, startTime, stopTime);
        this.scheduleNode(harmonic2, startTime, stopTime);

        noiseSource.start(startTime);
        noiseSource.stop(startTime + transientDuration);
        this.activeNodes.add(noiseSource);
    }
}
