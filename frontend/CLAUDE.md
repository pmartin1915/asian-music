# CLAUDE.md - Silk Road Composer Frontend

## Project Overview
React frontend for AI-powered traditional Chinese music composition using Vertex AI (Gemini 2.0 Flash for composition structure, Lyria-002 for audio synthesis).

## Tech Stack
- **React 18** with TypeScript (strict mode)
- **Vite** for build tooling
- **Tailwind CSS** for styling (custom colors: silk-stone, silk-amber, silk-red)
- **Firebase Functions** for backend API
- **Vitest** for testing

## Architecture

### Directory Structure
```
src/
├── components/      # React UI components
│   ├── AudioPlayer.tsx      # Single-track HTML5 audio player
│   ├── MixerPlayer.tsx      # Multi-track Web Audio API mixer
│   ├── ControlPanel.tsx     # Composition parameter form
│   ├── MathDisplay.tsx      # Euclidean rhythm visualization
│   ├── GenerationProgress.tsx # Step-by-step progress UI
│   ├── CompositionHistory.tsx # localStorage history list
│   └── Tooltip.tsx          # Accessible tooltip component
├── hooks/           # Custom React hooks
│   ├── useGeneration.ts     # Generation state machine
│   ├── useAudioMixer.ts     # Web Audio API mixer logic
│   └── useCompositionHistory.ts # localStorage CRUD
├── services/        # API communication
│   └── api.ts               # Firebase callable functions
├── types/           # TypeScript interfaces
│   └── music.ts             # Shared type definitions
├── utils/           # Utility functions
│   ├── audio.ts             # Base64/blob conversion
│   └── validation.ts        # Runtime type guards
├── config/          # Configuration
│   └── constants.ts         # Centralized constants
└── test/            # Test utilities
    └── setup.ts             # Vitest mocks
```

### Data Flow
1. User configures composition in `ControlPanel`
2. `App.tsx` calls `useGeneration.generate(params)`
3. `useGeneration` calls `composeMusic()` then `generateAudio()` per instrument
4. Audio results (base64) decoded via `utils/audio.ts`
5. Playback via `AudioPlayer` (single) or `MixerPlayer` (multi-track)

## Development Commands
```bash
npm run dev          # Start Vite dev server (port 5173)
npm run build        # TypeScript + Vite production build
npm test             # Run Vitest in watch mode
npm run test:run     # Single test run
npm run lint         # ESLint
```

## Testing
- **17 tests** covering ControlPanel, AudioPlayer, MathDisplay, API, types
- Mocks in `src/test/setup.ts` for Web Audio API, Blob URLs
- Uses minimal base64 content in tests to avoid memory issues

## Configuration
- **Constants**: `src/config/constants.ts` (timeouts, defaults, storage keys)
- **Firebase**: Environment variables `VITE_FIREBASE_*`
- **Emulator**: Automatically connects to `localhost:5001` in dev mode

## Common Patterns

### Audio Handling
```typescript
import { base64ToBlobUrl, base64ToArrayBuffer } from '../utils/audio';

// For HTML5 Audio element
const url = base64ToBlobUrl(audioContent);
// Remember: URL.revokeObjectURL(url) when done

// For Web Audio API
const buffer = base64ToArrayBuffer(audioContent);
const audioBuffer = await audioContext.decodeAudioData(buffer);
```

### Error Handling
- Use `toast.error()` from react-hot-toast for user-facing errors
- Console errors for debugging
- Try/catch with specific error messages

### localStorage Validation
```typescript
import { validateHistoryData } from '../utils/validation';
const data = validateHistoryData(JSON.parse(stored));
```

## Type Definitions (src/types/music.ts)
- `PentatonicMode`: 'gong' | 'shang' | 'jue' | 'zhi' | 'yu'
- `Instrument`: 'erhu' | 'guzheng' | 'pipa' | 'dizi'
- `Mood`: 'calm' | 'heroic' | 'melancholic' | 'festive'
- `CompositionParams`: User input for generation
- `Composition`: AI-generated structure (scale, motif, form, patterns)
- `AudioResult`: Base64 audio with metadata

## Known Patterns & Gotchas
1. **Blob URL cleanup**: Always revoke URLs to prevent memory leaks
2. **Audio context**: Must resume after user interaction (browser policy)
3. **localStorage quota**: History auto-trims if quota exceeded
4. **Section duration**: Hardcoded 15s in MathDisplay for visualization
