import type { Composition, CompositionParams, AudioResult, InstrumentAudioResult } from '../types/music';

// Mock composition data matching the Composition interface
export const mockComposition: Composition = {
  scale: ['C4', 'D4', 'E4', 'G4', 'A4'],
  motif: {
    pitches: ['C4', 'D4', 'E4', 'G4'],
    rhythm: [1, 0.5, 0.5, 2],
  },
  form: ['A', "A'", 'B', "A''"],
  instrumentRoles: {
    erhu: 'melody',
    guzheng: 'accompaniment',
  },
  euclideanPatterns: {
    melody: [1, 0, 0, 1, 0, 0, 1, 0],
    accompaniment: [1, 0, 1, 1, 0, 1, 1, 0],
  },
};

// Mock composition params matching the CompositionParams interface
export const mockParams: CompositionParams = {
  mode: 'gong',
  root: 'C',
  tempo: 72,
  instruments: ['erhu', 'guzheng'],
  mood: 'calm',
  seed: 12345,
};

// Mock audio result matching the AudioResult interface
export const mockAudioResult: AudioResult = {
  audioContent: 'SGVsbG8gV29ybGQh', // base64 encoded "Hello World!"
  mimeType: 'audio/wav',
  seed: 12345,
};

// Mock instrument audio result for multi-instrument support
export const mockInstrumentAudioResult: InstrumentAudioResult = {
  ...mockAudioResult,
  instrument: 'erhu',
};

// Helper to create a mock composition with custom values
export function createMockComposition(overrides: Partial<Composition> = {}): Composition {
  return { ...mockComposition, ...overrides };
}

// Helper to create mock params with custom values
export function createMockParams(overrides: Partial<CompositionParams> = {}): CompositionParams {
  return { ...mockParams, ...overrides };
}

// Helper to create mock audio result with custom values
export function createMockAudioResult(overrides: Partial<AudioResult> = {}): AudioResult {
  return { ...mockAudioResult, ...overrides };
}

// Helper to wait for async state updates
export function waitForAsync(ms: number = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
