import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { GoogleAuth } from "google-auth-library";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "silk-road-composer";
const LOCATION = "us-central1";

// Valid parameter values for input validation
const VALID_INSTRUMENTS = ['erhu', 'guzheng', 'pipa', 'dizi'] as const;
const VALID_MOODS = ['calm', 'heroic', 'melancholic', 'festive'] as const;

const MOOD_MAPPINGS: Record<string, string> = {
    calm: "peaceful, meditative, gentle, flowing",
    heroic: "bold, triumphant, energetic, powerful",
    melancholic: "sorrowful, longing, introspective, wistful",
    festive: "joyful, celebratory, lively, bright"
};

const templates: Record<string, (mood: string, tempo: number, mode: string) => { prompt: string, negative: string }> = {
    erhu: (mood, tempo, mode) => ({
        prompt: `Solo erhu (Chinese two-string fiddle) playing a ${mood} melody. Singing tone quality, extensive vibrato, portamento slides between notes, ${tempo} BPM, ${mode} pentatonic scale feeling. Intimate recording, slight room reverb, traditional Chinese classical style.`,
        negative: "Western violin, harsh, synthesizer, electronic"
    }),
    guzheng: (mood, tempo, mode) => ({
        prompt: `Guzheng (Chinese 21-string zither) with ${mood} arpeggiated patterns. Bright plucked strings, resonant decay, occasional glissando sweeps, ${tempo} BPM, ${mode} pentatonic tonality. Clean recording, natural string resonance, traditional Chinese folk style.`,
        negative: "Harp, guitar, harsh attack, electronic"
    }),
    pipa: (mood, tempo, mode) => ({
        prompt: `Pipa (Chinese four-string lute) with ${mood} character. Rapid tremolo picking, percussive attack, clear articulation, ${tempo} BPM rhythmic patterns, ${mode} pentatonic melodic figures. Detailed recording, traditional Chinese court music style.`,
        negative: "Guitar, mandolin, soft legato, Western"
    }),
    dizi: (mood, tempo, mode) => ({
        prompt: `Dizi (Chinese bamboo transverse flute) playing ${mood} melody. Breathy tone with buzzing membrane resonance, expressive ornaments, grace notes, ${tempo} BPM, ${mode} pentatonic phrases. Airy recording with slight reverb, traditional Chinese pastoral style.`,
        negative: "Western flute, recorder, synthetic"
    })
};

export const generate = onCall({ timeoutSeconds: 300 }, async (request) => {
    logger.info("Generate called", { data: request.data });

    // Authentication check - prevent unauthorized access
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in to use this service.");
    }

    const { composition, instrument } = request.data;

    // Validate instrument
    if (!instrument || typeof instrument !== 'string') {
        throw new HttpsError("invalid-argument", "Instrument is required.");
    }

    const normalizedInstrument = instrument.toLowerCase();
    if (!VALID_INSTRUMENTS.includes(normalizedInstrument as typeof VALID_INSTRUMENTS[number])) {
        throw new HttpsError("invalid-argument", `Invalid instrument: ${instrument}. Must be one of: ${VALID_INSTRUMENTS.join(', ')}`);
    }

    // Validate composition exists
    if (!composition) {
        throw new HttpsError("invalid-argument", "Composition data is required.");
    }

    // Get context parameters from request (frontend sends these alongside composition)
    const requestMood = request.data.mood || "calm";
    const requestTempo = request.data.tempo || 72;
    const requestMode = request.data.mode || "gong";
    const requestSeed = request.data.seed || Math.floor(Math.random() * 100000);

    // Validate mood if provided
    if (request.data.mood && !VALID_MOODS.includes(request.data.mood)) {
        throw new HttpsError("invalid-argument", `Invalid mood: ${request.data.mood}. Must be one of: ${VALID_MOODS.join(', ')}`);
    }

    // Get template
    const templateFn = templates[normalizedInstrument];
    if (!templateFn) {
        throw new HttpsError("invalid-argument", `Unsupported instrument: ${instrument}`);
    }

    const { prompt, negative } = templateFn(MOOD_MAPPINGS[requestMood] || requestMood, requestTempo, requestMode);

    try {
        const auth = new GoogleAuth({
            scopes: "https://www.googleapis.com/auth/cloud-platform"
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();

        const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/lyria-002:predict`;

        const response = await client.request({
            url: endpoint,
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token.token}`,
                "Content-Type": "application/json"
            },
            data: {
                instances: [{
                    prompt: prompt,
                    negative_prompt: negative,
                    seed: requestSeed
                }]
            }
        });

        const data = response.data as any;

        // Debug logging only in emulator
        if (process.env.FUNCTIONS_EMULATOR) {
            logger.info("Lyria Raw Response Keys:", Object.keys(data));
        }

        if (!data.predictions || data.predictions.length === 0) {
            logger.error("No predictions array in response");
            throw new Error("No predictions returned from Lyria.");
        }

        const prediction = data.predictions[0];
        const audioContent = prediction.audioContent || prediction;

        return {
            audioContent: typeof audioContent === 'string' ? audioContent : JSON.stringify(audioContent),
            mimeType: "audio/wav",
            seed: requestSeed
        };

    } catch (error) {
        logger.error("Error generating audio", error);
        // Sanitize error - do not expose internal details to client
        throw new HttpsError("internal", "Unable to generate audio at this time. Please try again.");
    }
});
