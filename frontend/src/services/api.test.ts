import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockComposition, mockParams, mockAudioResult } from '../test/utils';

// Create a shared mock callable that tests can configure
let mockCallableImpl = vi.fn();

// Mock Firebase modules - using inline functions due to hoisting
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn((functions, name, options) => {
    // Store the call info for assertions
    (httpsCallable as any).__lastCall = { name, options };
    return mockCallableImpl;
  }),
  getFunctions: vi.fn(() => ({})),
  connectFunctionsEmulator: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}));

// Import after mocking
import { composeMusic, generateAudio } from './api';
import { httpsCallable } from 'firebase/functions';

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallableImpl = vi.fn();
  });

  describe('composeMusic', () => {
    it('calls httpsCallable with compose function name and 60s timeout', async () => {
      mockCallableImpl.mockResolvedValue({ data: mockComposition });

      await composeMusic(mockParams);

      const lastCall = (httpsCallable as any).__lastCall;
      expect(lastCall.name).toBe('compose');
      expect(lastCall.options).toEqual({ timeout: 60000 });
    });

    it('passes composition params correctly', async () => {
      mockCallableImpl.mockResolvedValue({ data: mockComposition });

      await composeMusic(mockParams);

      expect(mockCallableImpl).toHaveBeenCalledWith(mockParams);
    });

    it('returns composition data from result', async () => {
      mockCallableImpl.mockResolvedValue({ data: mockComposition });

      const result = await composeMusic(mockParams);

      expect(result).toEqual(mockComposition);
      expect(result.scale).toHaveLength(5);
      expect(result.form).toContain('A');
    });

    it('propagates errors from Firebase function', async () => {
      const error = new Error('Firebase error');
      mockCallableImpl.mockRejectedValue(error);

      await expect(composeMusic(mockParams)).rejects.toThrow('Firebase error');
    });
  });

  describe('generateAudio', () => {
    it('calls httpsCallable with generate function name and 300s timeout', async () => {
      mockCallableImpl.mockResolvedValue({ data: mockAudioResult });

      await generateAudio(mockComposition, 'erhu', mockParams);

      const lastCall = (httpsCallable as any).__lastCall;
      expect(lastCall.name).toBe('generate');
      expect(lastCall.options).toEqual({ timeout: 300000 });
    });

    it('passes composition, instrument, and context correctly', async () => {
      mockCallableImpl.mockResolvedValue({ data: mockAudioResult });

      await generateAudio(mockComposition, 'erhu', mockParams);

      expect(mockCallableImpl).toHaveBeenCalledWith({
        composition: mockComposition,
        instrument: 'erhu',
        mode: 'gong',
        tempo: 72,
        mood: 'calm',
        seed: 12345,
      });
    });

    it('includes seed in request payload', async () => {
      mockCallableImpl.mockResolvedValue({ data: mockAudioResult });
      const paramsWithSeed = { ...mockParams, seed: 54321 };

      await generateAudio(mockComposition, 'pipa', paramsWithSeed);

      expect(mockCallableImpl).toHaveBeenCalledWith(
        expect.objectContaining({ seed: 54321 })
      );
    });

    it('returns audio result with audioContent, mimeType, seed', async () => {
      mockCallableImpl.mockResolvedValue({ data: mockAudioResult });

      const result = await generateAudio(mockComposition, 'erhu', mockParams);

      expect(result).toEqual(mockAudioResult);
      expect(result.audioContent).toBeDefined();
      expect(result.mimeType).toBe('audio/wav');
      expect(result.seed).toBe(12345);
    });

    it('propagates errors from Firebase function', async () => {
      const error = new Error('Audio generation failed');
      mockCallableImpl.mockRejectedValue(error);

      await expect(
        generateAudio(mockComposition, 'erhu', mockParams)
      ).rejects.toThrow('Audio generation failed');
    });
  });
});
