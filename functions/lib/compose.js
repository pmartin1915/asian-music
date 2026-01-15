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
exports.compose = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const vertexai_1 = require("@google-cloud/vertexai");
const retry_1 = require("./utils/retry");
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "silk-road-composer";
const LOCATION = "us-central1"; // Gemini 3 Pro availability
// Valid parameter values for input validation
const VALID_MODES = ['gong', 'shang', 'jue', 'zhi', 'yu'];
const VALID_INSTRUMENTS = ['erhu', 'guzheng', 'pipa', 'dizi'];
const VALID_MOODS = ['calm', 'heroic', 'melancholic', 'festive'];
exports.compose = (0, https_1.onCall)({ timeoutSeconds: 60 }, async (request) => {
    var _a, _b;
    logger.info("Compose called", { data: request.data });
    // Authentication check - require Firebase auth
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be logged in to use this service.");
    }
    const { mode, root, tempo, instruments, mood, seed } = request.data;
    // Validation - check existence
    if (!mode || !root || !tempo || !instruments || !mood) {
        throw new https_1.HttpsError("invalid-argument", "Missing required parameters.");
    }
    // Validation - check valid values
    if (!VALID_MODES.includes(mode)) {
        throw new https_1.HttpsError("invalid-argument", `Invalid mode: ${mode}. Must be one of: ${VALID_MODES.join(', ')}`);
    }
    if (!VALID_MOODS.includes(mood)) {
        throw new https_1.HttpsError("invalid-argument", `Invalid mood: ${mood}. Must be one of: ${VALID_MOODS.join(', ')}`);
    }
    if (!Array.isArray(instruments) || instruments.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "At least one instrument must be selected.");
    }
    for (const inst of instruments) {
        if (!VALID_INSTRUMENTS.includes(inst)) {
            throw new https_1.HttpsError("invalid-argument", `Invalid instrument: ${inst}. Must be one of: ${VALID_INSTRUMENTS.join(', ')}`);
        }
    }
    if (typeof tempo !== 'number' || tempo < 40 || tempo > 160) {
        throw new https_1.HttpsError("invalid-argument", "Tempo must be a number between 40 and 160 BPM.");
    }
    try {
        const vertexAI = new vertexai_1.VertexAI({ project: PROJECT_ID, location: LOCATION });
        const generativeModel = vertexAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                responseMimeType: "application/json"
            }
        });
        const prompt = `
            You are a Chinese classical music composer. Generate a composition structure.

            Chinese Pentatonic Modes (intervals from root in semitones):
            - gong: [0, 2, 4, 7, 9]
            - shang: [0, 2, 5, 7, 10]
            - jue: [0, 3, 5, 8, 10]
            - zhi: [0, 2, 5, 7, 9]
            - yu: [0, 3, 5, 7, 10]

            Context:
            - Mode: ${mode}
            - Root: ${root}
            - Tempo: ${tempo} BPM
            - Instruments: ${instruments.join(", ")}
            - Mood: ${mood}
            ${seed ? `- Seed: ${seed}` : ""}

            Rules:
            - Generate the scale pitches from root + mode
            - Create a 4-8 note motif using scale tones
            - Prefer stepwise motion (adjacent scale degrees)
            - If leap > 2 degrees, next note should move opposite direction
            - End phrases on 1st or 5th scale degree
            - Use Euclidean rhythm: E(5,8) for accompaniment, E(3,8) for melody
            - Structure: A A' B A'' form

            Respond ONLY with JSON matching this schema:
            {
                "scale": ["C4", "D4", "E4", "G4", "A4"],
                "motif": {
                "pitches": ["C4", "D4", "E4", "G4"],
                "rhythm": [1, 0.5, 0.5, 2]
                },
                "form": ["A", "A'", "B", "A''"],
                "instrumentRoles": {
                "erhu": "melody",
                "guzheng": "accompaniment"
                },
                "euclideanPatterns": {
                "melody": [1,0,0,1,0,0,1,0],
                "accompaniment": [1,0,1,1,0,1,1,0]
                }
            }
        `;
        // Use retry logic for transient Gemini API failures
        const result = await (0, retry_1.withRetry)(() => generativeModel.generateContent(prompt), {
            maxAttempts: 3,
            baseDelayMs: 1000,
            shouldRetry: retry_1.isTransientError,
        });
        const responseConfig = result.response;
        const text = (_a = responseConfig.candidates) === null || _a === void 0 ? void 0 : _a[0].content.parts[0].text;
        if (!text) {
            throw new Error("No content generated.");
        }
        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
        const composition = JSON.parse(jsonStr);
        return composition;
    }
    catch (error) {
        logger.error("Error generating composition", error);
        // Provide specific error messages based on error type
        const err = error;
        if (err.code === 'RESOURCE_EXHAUSTED' || err.status === 429) {
            throw new https_1.HttpsError("resource-exhausted", "Service temporarily unavailable due to high demand. Please try again in a few minutes.");
        }
        if (err.code === 'DEADLINE_EXCEEDED' || ((_b = err.message) === null || _b === void 0 ? void 0 : _b.includes('timeout'))) {
            throw new https_1.HttpsError("deadline-exceeded", "Generation took too long. Try selecting fewer instruments or a simpler composition.");
        }
        if (error instanceof SyntaxError) {
            throw new https_1.HttpsError("internal", "Received unexpected response format. Please try again.");
        }
        if (err.code === 'UNAVAILABLE') {
            throw new https_1.HttpsError("unavailable", "AI service is temporarily unavailable. Please try again later.");
        }
        // Default error message
        throw new https_1.HttpsError("internal", "Unable to generate composition at this time. Please try again.");
    }
});
//# sourceMappingURL=compose.js.map