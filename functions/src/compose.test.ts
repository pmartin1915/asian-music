import { compose } from './compose';

// Mock VertexAI
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
}));

jest.mock('@google-cloud/vertexai', () => ({
  VertexAI: jest.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

// Mock logger
jest.mock('firebase-functions/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

// Helper to create a mock request
function createMockRequest(data: Record<string, unknown>, auth: { uid: string } | null = { uid: 'test-user' }) {
  return { data, auth } as any;
}

// Valid test params
const validParams = {
  mode: 'gong',
  root: 'C',
  tempo: 72,
  instruments: ['erhu', 'guzheng'],
  mood: 'calm',
};

// Mock composition response
const mockCompositionResponse = {
  scale: ['C4', 'D4', 'E4', 'G4', 'A4'],
  motif: { pitches: ['C4', 'D4'], rhythm: [1, 0.5] },
  form: ['A', "A'", 'B', "A''"],
  instrumentRoles: { erhu: 'melody', guzheng: 'accompaniment' },
  euclideanPatterns: { melody: [1, 0, 0, 1], accompaniment: [1, 0, 1, 0] },
};

describe('compose Cloud Function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateContent.mockResolvedValue({
      response: {
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify(mockCompositionResponse) }],
          },
        }],
      },
    });
  });

  describe('Authentication', () => {
    it('throws unauthenticated error when request.auth is null', async () => {
      const request = createMockRequest(validParams, null);

      await expect(compose.run(request)).rejects.toThrow('User must be logged in to use this service.');
    });

    it('proceeds with authenticated requests', async () => {
      const request = createMockRequest(validParams);

      const result = await compose.run(request);

      expect(result).toBeDefined();
      expect(result.scale).toHaveLength(5);
    });
  });

  describe('Input Validation - Required Fields', () => {
    it('throws invalid-argument for missing mode', async () => {
      const params = { ...validParams, mode: undefined };
      const request = createMockRequest(params);

      await expect(compose.run(request)).rejects.toThrow('Missing required parameters.');
    });

    it('throws invalid-argument for missing root', async () => {
      const params = { ...validParams, root: undefined };
      const request = createMockRequest(params);

      await expect(compose.run(request)).rejects.toThrow('Missing required parameters.');
    });

    it('throws invalid-argument for missing tempo', async () => {
      const params = { ...validParams, tempo: undefined };
      const request = createMockRequest(params);

      await expect(compose.run(request)).rejects.toThrow('Missing required parameters.');
    });

    it('throws invalid-argument for missing instruments', async () => {
      const params = { ...validParams, instruments: undefined };
      const request = createMockRequest(params);

      await expect(compose.run(request)).rejects.toThrow('Missing required parameters.');
    });

    it('throws invalid-argument for missing mood', async () => {
      const params = { ...validParams, mood: undefined };
      const request = createMockRequest(params);

      await expect(compose.run(request)).rejects.toThrow('Missing required parameters.');
    });
  });

  describe('Input Validation - Invalid Values', () => {
    it('throws invalid-argument for invalid mode value', async () => {
      const params = { ...validParams, mode: 'invalid' };
      const request = createMockRequest(params);

      await expect(compose.run(request)).rejects.toThrow('Invalid mode: invalid. Must be one of: gong, shang, jue, zhi, yu');
    });

    it('throws invalid-argument for invalid mood value', async () => {
      const params = { ...validParams, mood: 'angry' };
      const request = createMockRequest(params);

      await expect(compose.run(request)).rejects.toThrow('Invalid mood: angry. Must be one of: calm, heroic, melancholic, festive');
    });

    it('throws invalid-argument for invalid instrument in array', async () => {
      const params = { ...validParams, instruments: ['erhu', 'guitar'] };
      const request = createMockRequest(params);

      await expect(compose.run(request)).rejects.toThrow('Invalid instrument: guitar. Must be one of: erhu, guzheng, pipa, dizi');
    });

    it('throws invalid-argument for tempo below 40', async () => {
      const params = { ...validParams, tempo: 20 };
      const request = createMockRequest(params);

      await expect(compose.run(request)).rejects.toThrow('Tempo must be a number between 40 and 160 BPM.');
    });

    it('throws invalid-argument for tempo above 160', async () => {
      const params = { ...validParams, tempo: 200 };
      const request = createMockRequest(params);

      await expect(compose.run(request)).rejects.toThrow('Tempo must be a number between 40 and 160 BPM.');
    });

    it('throws invalid-argument for empty instruments array', async () => {
      const params = { ...validParams, instruments: [] };
      const request = createMockRequest(params);

      await expect(compose.run(request)).rejects.toThrow('At least one instrument must be selected.');
    });

    it('throws invalid-argument for non-array instruments', async () => {
      const params = { ...validParams, instruments: 'erhu' };
      const request = createMockRequest(params);

      await expect(compose.run(request)).rejects.toThrow('At least one instrument must be selected.');
    });
  });

  describe('AI Integration', () => {
    it('calls Gemini with prompt including mode, root, tempo, instruments, mood', async () => {
      const request = createMockRequest(validParams);

      await compose.run(request);

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const prompt = mockGenerateContent.mock.calls[0][0];
      expect(prompt).toContain('gong');
      expect(prompt).toContain('C');
      expect(prompt).toContain('72');
      expect(prompt).toContain('erhu');
      expect(prompt).toContain('guzheng');
      expect(prompt).toContain('calm');
    });

    it('parses JSON response correctly', async () => {
      const request = createMockRequest(validParams);

      const result = await compose.run(request);

      expect(result.scale).toEqual(['C4', 'D4', 'E4', 'G4', 'A4']);
      expect(result.form).toEqual(['A', "A'", 'B', "A''"]);
      expect(result.instrumentRoles.erhu).toBe('melody');
    });

    it('cleans markdown code blocks from Gemini response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [{
            content: {
              parts: [{ text: '```json\n' + JSON.stringify(mockCompositionResponse) + '\n```' }],
            },
          }],
        },
      });

      const request = createMockRequest(validParams);
      const result = await compose.run(request);

      expect(result.scale).toBeDefined();
      expect(result.scale).toHaveLength(5);
    });

    it('returns sanitized internal error on AI failure (no stack traces)', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Gemini API error'));

      const request = createMockRequest(validParams);

      await expect(compose.run(request)).rejects.toThrow('Unable to generate composition at this time. Please try again.');
    });
  });

  describe('Valid Modes', () => {
    const validModes = ['gong', 'shang', 'jue', 'zhi', 'yu'];

    validModes.forEach((mode) => {
      it(`accepts valid mode: ${mode}`, async () => {
        const params = { ...validParams, mode };
        const request = createMockRequest(params);

        const result = await compose.run(request);

        expect(result).toBeDefined();
      });
    });
  });

  describe('Valid Moods', () => {
    const validMoods = ['calm', 'heroic', 'melancholic', 'festive'];

    validMoods.forEach((mood) => {
      it(`accepts valid mood: ${mood}`, async () => {
        const params = { ...validParams, mood };
        const request = createMockRequest(params);

        const result = await compose.run(request);

        expect(result).toBeDefined();
      });
    });
  });
});
