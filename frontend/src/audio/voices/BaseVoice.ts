/**
 * Abstract base class for instrument voices.
 * Provides common functionality for all synthesized instruments.
 */

import type { ScheduledNote, VoiceParameters, InstrumentVoice, ADSREnvelope } from '../types';
import type { Instrument } from '../../types/music';
import { applyADSREnvelope } from '../utils/envelope';

/**
 * Abstract base class that all instrument voices extend.
 */
export abstract class BaseVoice implements InstrumentVoice {
    abstract readonly instrument: Instrument;

    /** Maximum number of active nodes before cleanup is triggered */
    private static readonly MAX_ACTIVE_NODES = 500;

    protected context: BaseAudioContext;
    protected params: VoiceParameters;
    protected masterGain: GainNode;
    protected activeNodes: Set<AudioNode> = new Set();

    constructor(context: BaseAudioContext, params: VoiceParameters) {
        this.context = context;
        this.params = { ...params };
        this.masterGain = context.createGain();
        this.masterGain.gain.value = 0.7; // Default master level
    }

    /**
     * Connect the voice output to a destination.
     */
    connect(destination: AudioNode): void {
        this.masterGain.connect(destination);
    }

    /**
     * Disconnect from all destinations.
     */
    disconnect(): void {
        this.masterGain.disconnect();
    }

    /**
     * Schedule a note - must be implemented by subclasses.
     */
    abstract scheduleNote(note: ScheduledNote, destination: AudioNode): void;

    /**
     * Set a voice parameter.
     */
    setParameter(name: keyof VoiceParameters, value: number): void {
        if (name in this.params) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.params as any)[name] = value;
        }
    }

    /**
     * Get current parameters.
     */
    getParameters(): VoiceParameters {
        return { ...this.params };
    }

    /**
     * Dispose of all resources.
     */
    dispose(): void {
        this.disconnect();
        this.activeNodes.forEach(node => {
            try {
                if (node instanceof OscillatorNode) {
                    node.stop();
                }
            } catch {
                // Node may already be stopped
            }
        });
        this.activeNodes.clear();
    }

    /**
     * Create a gain node with ADSR envelope applied.
     */
    protected createEnvelopedGain(
        note: ScheduledNote,
        envelope: ADSREnvelope
    ): GainNode {
        const gain = this.context.createGain();
        gain.gain.value = 0;
        applyADSREnvelope(gain, envelope, note.startTime, note.duration, note.velocity);
        return gain;
    }

    /**
     * Create a lowpass filter.
     */
    protected createLowpassFilter(
        cutoff: number,
        resonance: number = 1
    ): BiquadFilterNode {
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = cutoff;
        filter.Q.value = resonance;
        return filter;
    }

    /**
     * Create a highpass filter.
     */
    protected createHighpassFilter(
        cutoff: number,
        resonance: number = 1
    ): BiquadFilterNode {
        const filter = this.context.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = cutoff;
        filter.Q.value = resonance;
        return filter;
    }

    /**
     * Create a bandpass filter.
     */
    protected createBandpassFilter(
        centerFreq: number,
        q: number = 1
    ): BiquadFilterNode {
        const filter = this.context.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = centerFreq;
        filter.Q.value = q;
        return filter;
    }

    /**
     * Create a simple oscillator at a frequency.
     */
    protected createOscillator(
        frequency: number,
        type: OscillatorType = 'sine'
    ): OscillatorNode {
        const osc = this.context.createOscillator();
        osc.type = type;
        osc.frequency.value = frequency;
        return osc;
    }

    /**
     * Create an LFO (low-frequency oscillator) for modulation.
     */
    protected createLFO(
        rate: number,
        depth: number,
        type: OscillatorType = 'sine'
    ): { lfo: OscillatorNode; gain: GainNode } {
        const lfo = this.context.createOscillator();
        lfo.type = type;
        lfo.frequency.value = rate;

        const gain = this.context.createGain();
        gain.gain.value = depth;

        lfo.connect(gain);

        return { lfo, gain };
    }

    /**
     * Apply vibrato to an oscillator.
     */
    protected applyVibrato(
        osc: OscillatorNode,
        rate: number,
        depthCents: number,
        startTime: number,
        duration: number
    ): OscillatorNode {
        const lfo = this.context.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = rate;

        // Convert cents to frequency ratio
        // depth in Hz = baseFreq * (2^(cents/1200) - 1)
        const baseFreq = osc.frequency.value;
        const depthHz = baseFreq * (Math.pow(2, depthCents / 1200) - 1);

        const lfoGain = this.context.createGain();
        lfoGain.gain.value = depthHz;

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        lfo.start(startTime);
        lfo.stop(startTime + duration + 0.5);

        this.activeNodes.add(lfo);
        return lfo;
    }

    /**
     * Schedule node start/stop and track for cleanup.
     */
    protected scheduleNode(
        node: OscillatorNode | AudioBufferSourceNode,
        startTime: number,
        stopTime: number
    ): void {
        // Prevent unbounded growth of active nodes
        if (this.activeNodes.size >= BaseVoice.MAX_ACTIVE_NODES) {
            this.pruneStoppedNodes();
        }

        node.start(startTime);
        node.stop(stopTime);
        this.activeNodes.add(node);

        // Remove from active nodes after stop
        node.onended = () => {
            this.activeNodes.delete(node);
        };
    }

    /**
     * Remove nodes that have already stopped to prevent memory leaks.
     */
    private pruneStoppedNodes(): void {
        const nodesToRemove: AudioNode[] = [];
        for (const node of this.activeNodes) {
            try {
                if (node instanceof OscillatorNode || node instanceof AudioBufferSourceNode) {
                    // Calling stop on an already stopped node throws an error
                    node.stop();
                }
            } catch {
                // Node has already stopped, safe to remove
                nodesToRemove.push(node);
            }
        }
        for (const node of nodesToRemove) {
            this.activeNodes.delete(node);
        }
    }

    /**
     * Create white noise source.
     */
    protected createNoiseSource(duration: number): AudioBufferSourceNode {
        const bufferSize = Math.ceil(this.context.sampleRate * duration);
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = this.context.createBufferSource();
        source.buffer = buffer;
        return source;
    }

    /**
     * Get the envelope for this voice.
     */
    protected get envelope(): ADSREnvelope {
        return this.params.envelope;
    }
}
