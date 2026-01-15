# Silk Road Composer

AI-powered traditional Asian music composition using Chinese pentatonic modes.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** Firebase Cloud Functions v2 (Node.js 20)
- **AI Models:**
  - Gemini 2.0 Flash (composition structure generation)
  - Lyria-002 (audio synthesis)

## Quick Start

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend (Firebase Functions)
cd functions && npm install && npm run build
```

## Architecture

```
User Input (ControlPanel)
       |
       v
composeMusic() --> Gemini 2.0 Flash --> Composition (scale, motif, form, patterns)
       |
       v
generateAudio() --> Lyria-002 --> Base64 WAV audio (per instrument)
       |
       v
AudioPlayer / MixerPlayer --> Web Audio API playback
```

### Key Components

- **ControlPanel:** Mode, root key, tempo, instruments, mood selection
- **MathDisplay:** Pentatonic scale, Euclidean rhythm geometry, musical form visualization
- **useGeneration:** Orchestrates compose -> generate flow with partial success handling
- **useAudioMixer:** Web Audio API multi-track playback with per-track volume/mute
- **useKeyboardShortcuts:** Keyboard shortcuts for playback (Space, Arrow keys, Home/End)

## Error Handling

The app uses typed error classes for proper categorization:

- `ApiError`: Firebase/network errors with retryable flag
- `AudioError`: Audio decoding/playback errors
- `GenerationError`: Composition failures with partial results support

### Retry Strategy

- Exponential backoff: 1s, 2s, 4s (max 10s)
- 30% jitter to prevent thundering herd
- 3 attempts for retryable errors (timeout, network, server errors)

### Partial Success

If some instruments fail during generation:
1. Successfully generated tracks are playable
2. Failed instruments can be retried individually
3. UI shows which tracks failed and offers retry button

## Development Guidelines

1. **Typed Errors:** Always throw `ApiError`, `AudioError`, or `GenerationError`
2. **Partial Success:** Don't abort on single instrument failure
3. **Blob Cleanup:** Revoke blob URLs when done to prevent memory leaks
4. **Test Coverage:** Run `npm test` before committing
5. **Auto-commit:** When completing tasks, commit changes without asking for confirmation

## Valid Parameters

| Parameter | Values |
|-----------|--------|
| mode | gong, shang, jue, zhi, yu |
| instruments | erhu, guzheng, pipa, dizi |
| mood | calm, heroic, melancholic, festive |
| tempo | 40-160 BPM |

## Testing

```bash
cd frontend && npm test           # Watch mode
cd frontend && npm run test:run   # Single run
cd functions && npm test          # Backend tests
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Toggle play/pause |
| ← Left Arrow | Seek backward 5 seconds |
| → Right Arrow | Seek forward 5 seconds |
| Home | Jump to beginning |
| End | Jump to end |

Shortcuts are active when audio is loaded and no input field is focused.

## Known Considerations

- Firebase Functions have 60s (compose) and 300s (generate) timeouts
- Lyria audio generation can take 30-60s per instrument
- Multi-track playback requires Web Audio API support
