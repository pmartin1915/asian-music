import { describe, it, expect } from 'vitest';
import type {
  PentatonicMode,
  Instrument,
  Mood,
  CompositionParams,
  Composition,
  AudioResult,
} from './music';

describe('Music Types', () => {
  describe('CompositionParams', () => {
    it('should accept valid composition parameters', () => {
      const params: CompositionParams = {
        mode: 'gong',
        root: 'C',
        tempo: 72,
        instruments: ['erhu', 'guzheng'],
        mood: 'calm',
      };

      expect(params.mode).toBe('gong');
      expect(params.instruments).toHaveLength(2);
      expect(params.seed).toBeUndefined();
    });

    it('should accept optional seed parameter', () => {
      const params: CompositionParams = {
        mode: 'yu',
        root: 'G',
        tempo: 120,
        instruments: ['dizi'],
        mood: 'heroic',
        seed: 12345,
      };

      expect(params.seed).toBe(12345);
    });
  });

  describe('Composition', () => {
    it('should represent a valid composition structure', () => {
      const composition: Composition = {
        scale: ['C4', 'D4', 'E4', 'G4', 'A4'],
        motif: {
          pitches: ['C4', 'D4', 'E4'],
          rhythm: [1, 0.5, 0.5],
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

      expect(composition.scale).toHaveLength(5);
      expect(composition.motif.pitches).toHaveLength(3);
      expect(composition.form).toContain('A');
    });
  });

  describe('AudioResult', () => {
    it('should represent valid audio result', () => {
      const result: AudioResult = {
        audioContent: 'base64encodedaudio',
        mimeType: 'audio/wav',
        seed: 42,
      };

      expect(result.mimeType).toBe('audio/wav');
      expect(result.seed).toBe(42);
    });
  });

  describe('Type constraints', () => {
    it('should only allow valid pentatonic modes', () => {
      const validModes: PentatonicMode[] = ['gong', 'shang', 'jue', 'zhi', 'yu'];
      expect(validModes).toHaveLength(5);
    });

    it('should only allow valid instruments', () => {
      const validInstruments: Instrument[] = ['erhu', 'guzheng', 'pipa', 'dizi'];
      expect(validInstruments).toHaveLength(4);
    });

    it('should only allow valid moods', () => {
      const validMoods: Mood[] = ['calm', 'heroic', 'melancholic', 'festive'];
      expect(validMoods).toHaveLength(4);
    });
  });
});
