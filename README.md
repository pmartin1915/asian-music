# Silk Road Composer

A web app that generates Chinese classical music using Vertex AI (Gemini + Lyria).

## Architecture

```ascii
+----------------+      +------------------+      +--------------------+
|  React Client  | ---> | Firebase Function| ---> | Vertex AI (Gemini) |
| (ControlPanel) |      |    (compose)     |      +--------------------+
+----------------+      +------------------+
        |                        |
        v                        v
+----------------+      +------------------+      +--------------------+
|  React Client  | ---> | Firebase Function| ---> | Vertex AI (Lyria)  |
| (AudioPlayer)  |      |    (generate)    |      +--------------------+
+----------------+      +------------------+
```

## Setup

1. **Install dependencies:**

   ```bash
   cd frontend && npm install
   cd ../functions && npm install
   ```

2. **Environment Variables:**
   - Ensure your Google Cloud Project has Vertex AI API enabled.
   - For local development, ensure you have `~/.config/gcloud/application_default_credentials.json` or run `gcloud auth application-default login`.

## Running Locally

1. **Start the Frontend:**

   ```bash
   cd frontend
   npm run dev
   ```

2. **Start the Backend Emulators:**

   ```bash
   cd functions
   npm run serve
   ```

   The frontend is configured to talk to `localhost:5001` in dev mode.

## Deploying

1. **Build Frontend:**

   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy to Firebase:**
   ```bash
   cd ..
   firebase deploy
   ```

## Technologies

- Frontend: React, Vite, Tailwind CSS
- Backend: Firebase Cloud Functions v2 (TypeScript)
- AI: Google Vertex AI (Gemini 1.5 Pro, Lyria-002)
