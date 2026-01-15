/**
 * Dizi (笛子) - Chinese bamboo flute.
 *
 * Characteristics:
 * - Pure, breathy tone
 * - Distinctive membrane buzz (mo/membrane)
 * - Expressive vibrato
 * - Soft attack from breath onset
 * - Grace notes and ornaments
 */

import { BaseVoice } from './BaseVoice';
import { applyFilterEnvelope } from '../utils/envelope';
import type { ScheduledNote, VoiceParameters } from '../types';
import type { Instrument } from '../../types/music';

export class DiziVoice extends BaseVoice {
    readonly instrument: Instrument = 'dizi';

    constructor(context: BaseAudioContext, params: VoiceParameters) {
        super(context, params);
    }

    scheduleNote(note: ScheduledNote, destination: AudioNode): void {
        const { frequency, startTime, duration, velocity } = note;
        const endTime = startTime + duration;

        // Main sine oscillator (pure flute tone)
        const mainOsc = this.createOscillator(frequency, 'sine');

        // FM modulator for richer overtones (simulates overblowing)
        const fmModulator = this.createOscillator(frequency * 2, 'sine');
        const fmGain = this.context.createGain();
        const fmDepth = this.params.fmDepth || 15; // Subtle FM modulation
        fmGain.gain.value = fmDepth;
        fmModulator.connect(fmGain);
        fmGain.connect(mainOsc.frequency);

        // Second harmonic for brightness
        const harmonic2 = this.createOscillator(frequency * 2, 'sine');
        const harmonic3 = this.createOscillator(frequency * 3, 'sine');

        // Mix harmonics
        const mainGain = this.context.createGain();
        const h2Gain = this.context.createGain();
        const h3Gain = this.context.createGain();
        mainGain.gain.value = 0.5;
        h2Gain.gain.value = 0.15;
        h3Gain.gain.value = 0.05;

        mainOsc.connect(mainGain);
        harmonic2.connect(h2Gain);
        harmonic3.connect(h3Gain);

        // Breath noise (increased for more realistic bamboo flute character)
        const breathiness = this.params.breathiness || 0.25;
        const breathNoise = this.createNoiseSource(duration + 0.5);
        const breathFilter = this.createBandpassFilter(2500, 0.8);
        const breathGain = this.context.createGain();

        breathNoise.connect(breathFilter);
        breathFilter.connect(breathGain);

        // Breath envelope
        breathGain.gain.setValueAtTime(0, startTime);
        breathGain.gain.linearRampToValueAtTime(breathiness * velocity * 0.3, startTime + 0.05);
        breathGain.gain.setValueAtTime(breathiness * velocity * 0.2, endTime);
        breathGain.gain.linearRampToValueAtTime(0, endTime + 0.1);

        // Membrane buzz simulation using ring modulation
        const membraneBuzz = this.params.membraneBuzz || 0.15;
        const buzzOsc = this.context.createOscillator();
        buzzOsc.type = 'sine';
        buzzOsc.frequency.value = 180 + Math.random() * 40; // Slight randomness

        const buzzGain = this.context.createGain();
        buzzGain.gain.value = membraneBuzz;

        // Create a subtle modulation of the main tone
        const modulatorGain = this.context.createGain();
        modulatorGain.gain.value = 1.0;

        buzzOsc.connect(buzzGain);
        // Modulate the amplitude slightly
        buzzGain.connect(modulatorGain.gain);

        // Vibrato
        const vibratoRate = this.params.vibratoRate || 4.5;
        const vibratoDepth = this.params.vibratoDepth || 20;

        // Delayed vibrato
        const vibratoDelay = this.envelope.attack + 0.1;
        if (duration > vibratoDelay) {
            this.applyVibrato(mainOsc, vibratoRate, vibratoDepth, startTime + vibratoDelay, duration - vibratoDelay);
            // Apply same vibrato to harmonics
            this.applyVibrato(harmonic2, vibratoRate, vibratoDepth, startTime + vibratoDelay, duration - vibratoDelay);
        }

        // Gentle lowpass for warmth with filter envelope for breath dynamics
        const baseCutoff = this.params.filterCutoff || 5000;
        const filter = this.createLowpassFilter(baseCutoff, this.params.filterResonance || 1);

        // Apply filter envelope - opens up on attack (breath onset) then settles
        applyFilterEnvelope(
            filter,
            baseCutoff * 0.5,    // Start slightly closed
            baseCutoff * 1.3,    // Peak on breath onset
            baseCutoff,          // Settle to base cutoff
            startTime,
            this.envelope.attack,
            this.envelope.decay * 2
        );

        // Main envelope (breath-like)
        const envelope = this.createEnvelopedGain(note, this.envelope);

        // Connect chain
        const preMix = this.context.createGain();
        preMix.gain.value = 1.0;

        mainGain.connect(preMix);
        h2Gain.connect(preMix);
        h3Gain.connect(preMix);

        preMix.connect(modulatorGain);
        modulatorGain.connect(filter);
        breathGain.connect(filter);
        filter.connect(envelope);

        envelope.connect(this.masterGain);
        this.masterGain.connect(destination);

        // Occasionally add grace notes (ornaments)
        // Require minimum time gap to prevent overlap with previous notes
        const graceNoteChance = 0.15;
        const minTimeForGrace = 0.12;
        if (Math.random() < graceNoteChance && duration > 0.3 && startTime > minTimeForGrace) {
            this.addGraceNote(note, destination, frequency);
        }

        // Schedule nodes
        const stopTime = endTime + (this.envelope.release || 0.15) + 0.2;
        this.scheduleNode(mainOsc, startTime, stopTime);
        this.scheduleNode(fmModulator, startTime, stopTime);
        this.scheduleNode(harmonic2, startTime, stopTime);
        this.scheduleNode(harmonic3, startTime, stopTime);

        buzzOsc.start(startTime);
        buzzOsc.stop(stopTime);
        this.activeNodes.add(buzzOsc);

        breathNoise.start(startTime);
        breathNoise.stop(stopTime);
        this.activeNodes.add(breathNoise);
    }

    /**
     * Add an ornamental grace note before the main note.
     */
    private addGraceNote(
        note: ScheduledNote,
        destination: AudioNode,
        mainFrequency: number
    ): void {
        // Grace note is typically a step above or below
        const interval = Math.random() > 0.5 ? 1.122 : 0.891; // Major 2nd up or down
        const graceFreq = mainFrequency * interval;
        const graceStart = note.startTime - 0.05; // Reduced from 0.08 to prevent overlap
        const graceDuration = 0.04; // Reduced from 0.06 for tighter ornament

        if (graceStart < 0) return;

        const graceOsc = this.createOscillator(graceFreq, 'sine');
        const graceGain = this.context.createGain();

        graceGain.gain.setValueAtTime(0, graceStart);
        graceGain.gain.linearRampToValueAtTime(note.velocity * 0.4, graceStart + 0.01);
        graceGain.gain.exponentialRampToValueAtTime(0.001, graceStart + graceDuration);

        const graceFilter = this.createLowpassFilter(4000, 1);

        graceOsc.connect(graceGain);
        graceGain.connect(graceFilter);
        graceFilter.connect(this.masterGain);
        this.masterGain.connect(destination);

        this.scheduleNode(graceOsc, graceStart, graceStart + graceDuration + 0.05);
    }
}
