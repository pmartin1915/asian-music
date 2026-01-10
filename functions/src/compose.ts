import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { VertexAI } from "@google-cloud/vertexai";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "silk-road-composer";
const LOCATION = "us-central1"; // Gemini 3 Pro availability

// Valid parameter values for input validation
const VALID_MODES = ['gong', 'shang', 'jue', 'zhi', 'yu'] as const;
const VALID_INSTRUMENTS = ['erhu', 'guzheng', 'pipa', 'dizi'] as const;
const VALID_MOODS = ['calm', 'heroic', 'melancholic', 'festive'] as const;

export const compose = onCall({ timeoutSeconds: 60 }, async (request) => {
    logger.info("Compose called", { data: request.data });

    // Authentication check - prevent unauthorized access
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in to use this service.");
    }

    const { mode, root, tempo, instruments, mood, seed } = request.data;

    // Validation - check existence
    if (!mode || !root || !tempo || !instruments || !mood) {
        throw new HttpsError("invalid-argument", "Missing required parameters.");
    }

    // Validation - check valid values
    if (!VALID_MODES.includes(mode)) {
        throw new HttpsError("invalid-argument", `Invalid mode: ${mode}. Must be one of: ${VALID_MODES.join(', ')}`);
    }

    if (!VALID_MOODS.includes(mood)) {
        throw new HttpsError("invalid-argument", `Invalid mood: ${mood}. Must be one of: ${VALID_MOODS.join(', ')}`);
    }

    if (!Array.isArray(instruments) || instruments.length === 0) {
        throw new HttpsError("invalid-argument", "At least one instrument must be selected.");
    }

    for (const inst of instruments) {
        if (!VALID_INSTRUMENTS.includes(inst)) {
            throw new HttpsError("invalid-argument", `Invalid instrument: ${inst}. Must be one of: ${VALID_INSTRUMENTS.join(', ')}`);
        }
    }

    if (typeof tempo !== 'number' || tempo < 40 || tempo > 160) {
        throw new HttpsError("invalid-argument", "Tempo must be a number between 40 and 160 BPM.");
    }

    try {
        const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
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

        const result = await generativeModel.generateContent(prompt);
        const responseConfig = result.response;
        const text = responseConfig.candidates?.[0].content.parts[0].text;

        if (!text) {
             throw new Error("No content generated.");
        }

        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
        const composition = JSON.parse(jsonStr);

        return composition;

    } catch (error) {
        logger.error("Error generating composition", error);
        // Sanitize error - do not expose internal details to client
        throw new HttpsError("internal", "Unable to generate composition at this time. Please try again.");
    }
});
