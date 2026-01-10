# Silk Road Composer - Frontend

React frontend for the Silk Road Composer, an AI-powered traditional Chinese music generation application.

## Features

- **Pentatonic Mode Selection**: Choose from 5 traditional Chinese modes (Gong, Shang, Jue, Zhi, Yu)
- **Multi-Instrument Ensemble**: Erhu, Guzheng, Pipa, Dizi with individual mixing controls
- **Real-time Visualization**: Animated Euclidean rhythm circles and musical form timeline
- **Composition History**: Auto-saved to localStorage with quick-load functionality
- **Educational Tooltips**: Learn about modes, instruments, and rhythmic patterns

## Tech Stack

- React 18 + TypeScript
- Vite (build tooling)
- Tailwind CSS (styling)
- Firebase Functions (backend API)
- Vitest (testing)

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project with Functions enabled

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

### Development

```bash
# Start dev server (connects to Firebase emulator at localhost:5001)
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Project Structure

```
src/
├── components/     # UI components (ControlPanel, Players, Visualizations)
├── hooks/          # Custom hooks (useGeneration, useAudioMixer, useCompositionHistory)
├── services/       # API integration (Firebase callable functions)
├── types/          # TypeScript type definitions
├── utils/          # Utilities (audio encoding, validation)
├── config/         # Configuration constants
└── test/           # Test setup and mocks
```

## Key Components

| Component | Purpose |
|-----------|---------|
| `ControlPanel` | User input form for composition parameters |
| `MathDisplay` | Euclidean rhythm and form visualization |
| `AudioPlayer` | Single-track HTML5 audio playback |
| `MixerPlayer` | Multi-track Web Audio API mixer |
| `GenerationProgress` | Step-by-step generation status |
| `CompositionHistory` | Saved composition list with quick-load |

## Testing

```bash
npm test           # Watch mode
npm run test:run   # Single run
```

Tests cover:
- Component rendering and interactions
- API integration
- Type validations

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed developer documentation and AI assistant guidelines.
