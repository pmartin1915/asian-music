import { generate } from './generate';

// Mock Google Auth
const mockRequest = jest.fn();
const mockGetAccessToken = jest.fn(() => ({ token: 'mock-token' }));
const mockGetClient = jest.fn(() => ({
  getAccessToken: mockGetAccessToken,
  request: mockRequest,
}));

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn(() => ({
    getClient: mockGetClient,
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

// Mock composition
const mockComposition = {
  scale: ['C4', 'D4', 'E4', 'G4', 'A4'],
  motif: { pitches: ['C4', 'D4'], rhythm: [1, 0.5] },
  form: ['A', "A'", 'B', "A''"],
  instrumentRoles: { erhu: 'melody' },
  euclideanPatterns: { melody: [1, 0, 0, 1] },
};

// Valid test params
const validParams = {
  composition: mockComposition,
  instrument: 'erhu',
  mood: 'calm',
  tempo: 72,
  mode: 'gong',
  seed: 12345,
};

describe('generate Cloud Function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockResolvedValue({
      data: {
        predictions: [{
          audioContent: 'base64encodedaudio',
        }],
      },
    });
  });

  describe('Authentication', () => {
    it('throws unauthenticated error when request.auth is null', async () => {
      const request = createMockRequest(validParams, null);

      await expect(generate.run(request)).rejects.toThrow('User must be logged in to use this service.');
    });

    it('proceeds with authenticated requests', async () => {
      const request = createMockRequest(validParams);

      const result = await generate.run(request);

      expect(result).toBeDefined();
      expect(result.audioContent).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    it('throws invalid-argument for missing instrument', async () => {
      const params = { ...validParams, instrument: undefined };
      const request = createMockRequest(params);

      await expect(generate.run(request)).rejects.toThrow('Instrument is required.');
    });

    it('throws invalid-argument for missing composition', async () => {
      const params = { ...validParams, composition: undefined };
      const request = createMockRequest(params);

      await expect(generate.run(request)).rejects.toThrow('Composition data is required.');
    });

    it('validates instrument is in VALID_INSTRUMENTS array', async () => {
      const params = { ...validParams, instrument: 'guitar' };
      const request = createMockRequest(params);

      await expect(generate.run(request)).rejects.toThrow('Invalid instrument: guitar. Must be one of: erhu, guzheng, pipa, dizi');
    });

    it('normalizes instrument to lowercase before validation', async () => {
      const params = { ...validParams, instrument: 'ERHU' };
      const request = createMockRequest(params);

      const result = await generate.run(request);

      expect(result.audioContent).toBeDefined();
    });

    it('throws invalid-argument for invalid mood if provided', async () => {
      const params = { ...validParams, mood: 'angry' };
      const request = createMockRequest(params);

      await expect(generate.run(request)).rejects.toThrow('Invalid mood: angry. Must be one of: calm, heroic, melancholic, festive');
    });
  });

  describe('Template Selection', () => {
    it('uses erhu template with singing tone, vibrato, portamento', async () => {
      const params = { ...validParams, instrument: 'erhu' };
      const request = createMockRequest(params);

      await generate.run(request);

      const requestCall = mockRequest.mock.calls[0][0];
      const prompt = requestCall.data.instances[0].prompt;
      expect(prompt).toContain('erhu');
      expect(prompt).toContain('vibrato');
      expect(prompt).toContain('portamento');
    });

    it('uses guzheng template with arpeggiated patterns, glissando', async () => {
      const params = { ...validParams, instrument: 'guzheng' };
      const request = createMockRequest(params);

      await generate.run(request);

      const requestCall = mockRequest.mock.calls[0][0];
      const prompt = requestCall.data.instances[0].prompt;
      expect(prompt).toContain('Guzheng');
      expect(prompt).toContain('arpeggiated');
      expect(prompt).toContain('glissando');
    });

    it('uses pipa template with tremolo picking, percussive attack', async () => {
      const params = { ...validParams, instrument: 'pipa' };
      const request = createMockRequest(params);

      await generate.run(request);

      const requestCall = mockRequest.mock.calls[0][0];
      const prompt = requestCall.data.instances[0].prompt;
      expect(prompt).toContain('Pipa');
      expect(prompt).toContain('tremolo');
      expect(prompt).toContain('percussive');
    });

    it('uses dizi template with breathy tone, buzzing membrane', async () => {
      const params = { ...validParams, instrument: 'dizi' };
      const request = createMockRequest(params);

      await generate.run(request);

      const requestCall = mockRequest.mock.calls[0][0];
      const prompt = requestCall.data.instances[0].prompt;
      expect(prompt).toContain('Dizi');
      expect(prompt.toLowerCase()).toContain('breathy');
      expect(prompt).toContain('buzzing');
    });

    it('applies mood mapping correctly (calm -> peaceful, meditative)', async () => {
      const params = { ...validParams, mood: 'calm' };
      const request = createMockRequest(params);

      await generate.run(request);

      const requestCall = mockRequest.mock.calls[0][0];
      const prompt = requestCall.data.instances[0].prompt;
      expect(prompt).toContain('peaceful');
      expect(prompt).toContain('meditative');
    });

    it('applies mood mapping correctly (heroic -> bold, triumphant)', async () => {
      const params = { ...validParams, mood: 'heroic' };
      const request = createMockRequest(params);

      await generate.run(request);

      const requestCall = mockRequest.mock.calls[0][0];
      const prompt = requestCall.data.instances[0].prompt;
      expect(prompt).toContain('bold');
      expect(prompt).toContain('triumphant');
    });
  });

  describe('Lyria API Integration', () => {
    it('calls Lyria API with correct endpoint (lyria-002:predict)', async () => {
      const request = createMockRequest(validParams);

      await generate.run(request);

      const requestCall = mockRequest.mock.calls[0][0];
      expect(requestCall.url).toContain('lyria-002:predict');
    });

    it('includes prompt, negative_prompt, seed in request body', async () => {
      const request = createMockRequest(validParams);

      await generate.run(request);

      const requestCall = mockRequest.mock.calls[0][0];
      const instance = requestCall.data.instances[0];
      expect(instance.prompt).toBeDefined();
      expect(instance.negative_prompt).toBeDefined();
      expect(instance.seed).toBeDefined();
    });

    it('returns audioContent, mimeType, seed on success', async () => {
      const request = createMockRequest(validParams);

      const result = await generate.run(request);

      expect(result.audioContent).toBe('base64encodedaudio');
      expect(result.mimeType).toBe('audio/wav');
      expect(result.seed).toBeDefined();
    });

    it('handles missing predictions array gracefully', async () => {
      mockRequest.mockResolvedValue({
        data: {},
      });

      const request = createMockRequest(validParams);

      await expect(generate.run(request)).rejects.toThrow('Unable to generate audio at this time. Please try again.');
    });

    it('handles empty predictions array gracefully', async () => {
      mockRequest.mockResolvedValue({
        data: { predictions: [] },
      });

      const request = createMockRequest(validParams);

      await expect(generate.run(request)).rejects.toThrow('Unable to generate audio at this time. Please try again.');
    });

    it('returns sanitized internal error on API failure (no stack traces)', async () => {
      mockRequest.mockRejectedValue(new Error('Lyria API error'));

      const request = createMockRequest(validParams);

      await expect(generate.run(request)).rejects.toThrow('Unable to generate audio at this time. Please try again.');
    });
  });

  describe('Valid Instruments', () => {
    const validInstruments = ['erhu', 'guzheng', 'pipa', 'dizi'];

    validInstruments.forEach((instrument) => {
      it(`accepts valid instrument: ${instrument}`, async () => {
        const params = { ...validParams, instrument };
        const request = createMockRequest(params);

        const result = await generate.run(request);

        expect(result.audioContent).toBeDefined();
      });
    });
  });

  describe('Default Values', () => {
    it('uses default mood (calm) when not provided', async () => {
      const params = { composition: mockComposition, instrument: 'erhu' };
      const request = createMockRequest(params);

      await generate.run(request);

      const requestCall = mockRequest.mock.calls[0][0];
      const prompt = requestCall.data.instances[0].prompt;
      expect(prompt).toContain('peaceful');
    });

    it('uses default tempo (72) when not provided', async () => {
      const params = { composition: mockComposition, instrument: 'erhu' };
      const request = createMockRequest(params);

      await generate.run(request);

      const requestCall = mockRequest.mock.calls[0][0];
      const prompt = requestCall.data.instances[0].prompt;
      expect(prompt).toContain('72');
    });

    it('generates random seed when not provided', async () => {
      const params = { composition: mockComposition, instrument: 'erhu' };
      const request = createMockRequest(params);

      await generate.run(request);

      const requestCall = mockRequest.mock.calls[0][0];
      const seed = requestCall.data.instances[0].seed;
      expect(typeof seed).toBe('number');
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(100000);
    });
  });
});
