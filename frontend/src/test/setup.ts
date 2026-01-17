import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock URL.createObjectURL and revokeObjectURL (jsdom doesn't support these)
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock HTMLAudioElement (jsdom has limited audio support)
Object.defineProperty(global, 'Audio', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    load: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    src: '',
    currentTime: 0,
    duration: 100,
  })),
});

// Mock window.atob for base64 decoding in tests
if (typeof global.atob === 'undefined') {
  global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}

if (typeof global.btoa === 'undefined') {
  global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
}

// Mock Blob if needed (jsdom should have this but just in case)
if (typeof global.Blob === 'undefined') {
  global.Blob = class MockBlob {
    constructor(public parts: BlobPart[], public options?: BlobPropertyBag) {}
  } as unknown as typeof Blob;
}

// Mock AudioContext for Web Audio API (used by useAudioMixer)
class MockAudioContext {
  destination = {};
  currentTime = 0;
  state: AudioContextState = 'running';

  createGain = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  }));

  createBufferSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null,
  }));

  decodeAudioData = vi.fn().mockResolvedValue({
    duration: 60,
    numberOfChannels: 2,
    sampleRate: 44100,
  });

  resume = vi.fn().mockResolvedValue(undefined);
  suspend = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

global.AudioContext = MockAudioContext as unknown as typeof AudioContext;
(global.window as unknown as { AudioContext: typeof AudioContext }).AudioContext = global.AudioContext;
(global.window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext = global.AudioContext;
