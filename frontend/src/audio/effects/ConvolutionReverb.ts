/**
 * Convolution reverb effect using procedurally generated impulse responses.
 * No external audio files needed.
 */

export interface ReverbOptions {
    /** Room size: 0 = small, 1 = large (default 0.5) */
    roomSize?: number;
    /** Decay time in seconds (default 1.5) */
    decayTime?: number;
    /** High frequency damping: 0 = bright, 1 = dark (default 0.5) */
    damping?: number;
    /** Pre-delay in milliseconds (default 20) */
    preDelay?: number;
    /** Wet/dry mix: 0 = dry, 1 = full wet (default 0.3) */
    mix?: number;
}

const DEFAULT_OPTIONS: Required<ReverbOptions> = {
    roomSize: 0.5,
    decayTime: 1.5,
    damping: 0.5,
    preDelay: 20,
    mix: 0.3,
};

/**
 * Generate a procedural impulse response for reverb.
 */
export function generateImpulseResponse(
    context: BaseAudioContext,
    options: ReverbOptions = {}
): AudioBuffer {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const sampleRate = context.sampleRate;

    // Calculate buffer length based on decay time and room size
    const length = Math.ceil(sampleRate * opts.decayTime * (0.5 + opts.roomSize * 0.5));
    const buffer = context.createBuffer(2, length, sampleRate);

    // Pre-delay in samples
    const preDelaySamples = Math.floor((opts.preDelay / 1000) * sampleRate);

    // Generate impulse for each channel
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);

        // Early reflections
        const numEarlyReflections = Math.floor(6 + opts.roomSize * 8);
        const earlyReflectionEnd = Math.floor(sampleRate * 0.08 * (1 + opts.roomSize));

        for (let i = 0; i < numEarlyReflections; i++) {
            const position = preDelaySamples + Math.floor(Math.random() * earlyReflectionEnd);
            if (position < length) {
                // Randomize amplitude and polarity
                const amplitude = 0.5 * Math.pow(0.85, i) * (Math.random() * 0.5 + 0.5);
                const polarity = Math.random() > 0.5 ? 1 : -1;
                data[position] = amplitude * polarity;
            }
        }

        // Diffuse tail using exponential decay with noise
        const decayStart = preDelaySamples + earlyReflectionEnd;
        const decayConstant = -6.9 / (opts.decayTime * sampleRate); // ln(0.001) / decay samples

        for (let i = decayStart; i < length; i++) {
            // Exponential decay envelope
            const t = i - decayStart;
            const envelope = Math.exp(decayConstant * t);

            // Add noise with envelope
            const noise = (Math.random() * 2 - 1) * envelope;

            // Apply damping (simple lowpass by averaging)
            const dampingFactor = 1 - opts.damping * 0.8;
            if (i > 0) {
                data[i] = noise * dampingFactor + data[i - 1] * (1 - dampingFactor) * 0.95;
            } else {
                data[i] = noise;
            }
        }

        // Normalize
        let maxVal = 0;
        for (let i = 0; i < length; i++) {
            maxVal = Math.max(maxVal, Math.abs(data[i]));
        }
        if (maxVal > 0) {
            const scale = 0.8 / maxVal;
            for (let i = 0; i < length; i++) {
                data[i] *= scale;
            }
        }
    }

    return buffer;
}

/**
 * Create a convolution reverb node with procedural impulse response.
 */
export function createConvolutionReverb(
    context: BaseAudioContext,
    options: ReverbOptions = {}
): ConvolverNode {
    const convolver = context.createConvolver();
    convolver.buffer = generateImpulseResponse(context, options);
    return convolver;
}

/**
 * Create a complete reverb effect chain with wet/dry mix.
 */
export interface ReverbChain {
    input: GainNode;
    output: GainNode;
    dryGain: GainNode;
    wetGain: GainNode;
    convolver: ConvolverNode;
    setMix: (mix: number) => void;
}

export function createReverbChain(
    context: BaseAudioContext,
    options: ReverbOptions = {}
): ReverbChain {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Create nodes
    const input = context.createGain();
    const output = context.createGain();
    const dryGain = context.createGain();
    const wetGain = context.createGain();
    const convolver = createConvolutionReverb(context, opts);

    // Set initial mix
    dryGain.gain.value = 1 - opts.mix;
    wetGain.gain.value = opts.mix;

    // Connect: input -> dry -> output
    //          input -> convolver -> wet -> output
    input.connect(dryGain);
    dryGain.connect(output);

    input.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(output);

    return {
        input,
        output,
        dryGain,
        wetGain,
        convolver,
        setMix: (mix: number) => {
            const clampedMix = Math.max(0, Math.min(1, mix));
            dryGain.gain.value = 1 - clampedMix;
            wetGain.gain.value = clampedMix;
        },
    };
}

/**
 * Reverb presets for different moods.
 */
export const REVERB_PRESETS: Record<string, ReverbOptions> = {
    // Calm: Larger room, longer decay, more wet
    calm: {
        roomSize: 0.7,
        decayTime: 2.0,
        damping: 0.4,
        preDelay: 30,
        mix: 0.35,
    },
    // Heroic: Medium room, shorter decay, less wet
    heroic: {
        roomSize: 0.5,
        decayTime: 1.2,
        damping: 0.3,
        preDelay: 15,
        mix: 0.2,
    },
    // Melancholic: Large room, long decay, darker
    melancholic: {
        roomSize: 0.8,
        decayTime: 2.5,
        damping: 0.6,
        preDelay: 40,
        mix: 0.4,
    },
    // Festive: Smaller room, punchy decay, brighter
    festive: {
        roomSize: 0.4,
        decayTime: 1.0,
        damping: 0.2,
        preDelay: 10,
        mix: 0.25,
    },
};
