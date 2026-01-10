"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const google_auth_library_1 = require("google-auth-library");
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "silk-road-composer";
const LOCATION = "us-central1";
const MOOD_MAPPINGS = {
    calm: "peaceful, meditative, gentle, flowing",
    heroic: "bold, triumphant, energetic, powerful",
    melancholic: "sorrowful, longing, introspective, wistful",
    festive: "joyful, celebratory, lively, bright"
};
const templates = {
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
exports.generate = (0, https_1.onCall)({ timeoutSeconds: 300 }, async (request) => {
    logger.info("Generate called", { data: request.data });
    const { composition, instrument } = request.data;
    const { mode, root, tempo, mood, seed } = composition || {}; // Assuming composition input might carry these context fields or they are passed separately. 
    // Wait, the user prompt says "composition: the JSON from compose function". 
    // However, the compose function output doesn't strictly have "mood", "tempo" etc at the top level of the JSON schema requested in Phase 2.
    // The compose function OUTPUT schema is: { scale, motif, form, instrumentRoles, euclideanPatterns }.
    // It DOES NOT contain tempo, mood, or mode context in the returned JSON.
    // I need to assume the Frontend passes the context again, OR I should have added it to the composition output in Phase 2. 
    // Let's modify the code to expect 'context' in the request or extract it if I can.
    // Re-reading Phase 3 prompt: "Accepts POST request with: composition, instrument".
    // AND templates require ${mood}, ${tempo}, ${mode}.
    // Implementation Detail: I will simply pass these as extra args in the generate call from the frontend or 
    // ensure they are part of the 'composition' object if I modify compose.ts.
    // For now, I'll extract them from `request.data` assuming the frontend sends them alongside `composition` or strictly inside it.
    // To be safe, I'll update the frontend to send { composition, instrument, context: { mood, tempo, mode } }. 
    // Or I can just grab them from request.data if they are top-level.
    // Let's assume request.data has { composition, instrument, mood, tempo, mode }. 
    const requestMood = request.data.mood || "calm";
    const requestTempo = request.data.tempo || 72;
    const requestMode = request.data.mode || "gong";
    const requestSeed = request.data.seed || Math.floor(Math.random() * 100000);
    // Get template
    const templateFn = templates[instrument === null || instrument === void 0 ? void 0 : instrument.toLowerCase()];
    if (!templateFn) {
        throw new https_1.HttpsError("invalid-argument", `Unsupported instrument: ${instrument}`);
    }
    const { prompt, negative } = templateFn(MOOD_MAPPINGS[requestMood] || requestMood, requestTempo, requestMode);
    try {
        const auth = new google_auth_library_1.GoogleAuth({
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
        const data = response.data;
        // DEBUGGING: Log raw response structure
        logger.info("Lyria Raw Response Keys:", Object.keys(data));
        logger.info("Lyria Full Response:", JSON.stringify(data, null, 2));
        if (!data.predictions || data.predictions.length === 0) {
            logger.error("No predictions array in response:", data);
            throw new Error("No predictions returned from Lyria.");
        }
        logger.info("Predictions array length:", data.predictions.length);
        logger.info("First prediction keys:", Object.keys(data.predictions[0]));
        logger.info("First prediction value:", JSON.stringify(data.predictions[0], null, 2));
        const prediction = data.predictions[0];
        const audioContent = prediction.audioContent || prediction;
        logger.info("Audio content type:", typeof audioContent);
        logger.info("Audio content is string:", typeof audioContent === 'string');
        if (typeof audioContent === 'string') {
            logger.info("Audio content length:", audioContent.length);
            logger.info("Audio content first 100 chars:", audioContent.substring(0, 100));
        }
        return {
            audioContent: typeof audioContent === 'string' ? audioContent : JSON.stringify(audioContent),
            mimeType: "audio/wav",
            seed: requestSeed
        };
    }
    catch (error) {
        logger.error("Error generating audio", error);
        throw new https_1.HttpsError("internal", "Failed to generate audio", error);
    }
});
//# sourceMappingURL=generate.js.map