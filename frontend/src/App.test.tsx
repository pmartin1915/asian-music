import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockComposition, mockAudioResult } from './test/utils';

// Mock the API module - must use inline functions due to hoisting
vi.mock('./services/api', () => ({
  composeMusic: vi.fn(),
  generateAudio: vi.fn(),
  synthesizeAudio: vi.fn(),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null,
}));

// Import after mocking
import App from './App';
import * as api from './services/api';
import toast from 'react-hot-toast';

const mockComposeMusic = api.composeMusic as ReturnType<typeof vi.fn>;
const mockGenerateAudio = api.generateAudio as ReturnType<typeof vi.fn>;
const mockSynthesizeAudio = api.synthesizeAudio as ReturnType<typeof vi.fn>;
const mockToast = toast as unknown as {
  loading: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  dismiss: ReturnType<typeof vi.fn>;
};

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComposeMusic.mockResolvedValue(mockComposition);
    mockGenerateAudio.mockResolvedValue(mockAudioResult);
    mockSynthesizeAudio.mockResolvedValue(mockAudioResult);
  });

  describe('Rendering', () => {
    it('renders header with title', () => {
      render(<App />);

      expect(screen.getByText('Silk Road Composer')).toBeInTheDocument();
    });

    it('renders Web Audio Synthesis badge', () => {
      render(<App />);

      expect(screen.getByText('Web Audio Synthesis')).toBeInTheDocument();
    });

    it('renders ControlPanel component', () => {
      render(<App />);

      expect(screen.getByText('Composition Controls')).toBeInTheDocument();
    });

    it('renders MathDisplay component with waiting message initially', () => {
      render(<App />);

      expect(screen.getByText('Waiting for inspiration...')).toBeInTheDocument();
    });

    it('renders instructions section', () => {
      render(<App />);

      expect(screen.getByText('How it works')).toBeInTheDocument();
    });
  });

  describe('Compose → Generate Flow', () => {
    it('calls composeMusic when ControlPanel triggers onGenerate', async () => {
      render(<App />);

      const generateButton = screen.getByRole('button', { name: /generate music/i });
      await userEvent.click(generateButton);

      await waitFor(() => {
        expect(mockComposeMusic).toHaveBeenCalledTimes(1);
      });
    });

    it('updates composition state after successful compose', async () => {
      render(<App />);

      const generateButton = screen.getByRole('button', { name: /generate music/i });
      await userEvent.click(generateButton);

      await waitFor(() => {
        // MathDisplay should now show scale notes instead of waiting message
        expect(screen.getByText('Pentatonic Scale Structure')).toBeInTheDocument();
      });
    });

    it('calls synthesizeAudio for each selected instrument', async () => {
      // Setup to select 2 instruments
      render(<App />);

      // Select guzheng in addition to default erhu
      const guzhengButton = screen.getByRole('button', { name: /guzheng/i });
      await userEvent.click(guzhengButton);

      const generateButton = screen.getByRole('button', { name: /generate music/i });
      await userEvent.click(generateButton);

      await waitFor(() => {
        // Should be called twice (once for erhu, once for guzheng)
        expect(mockSynthesizeAudio).toHaveBeenCalledTimes(2);
      });
    });

    it('creates blob URL from base64 audio data', async () => {
      render(<App />);

      const generateButton = screen.getByRole('button', { name: /generate music/i });
      await userEvent.click(generateButton);

      await waitFor(() => {
        expect(global.URL.createObjectURL).toHaveBeenCalled();
      });
    });

    it('shows success toast with instrument list', async () => {
      render(<App />);

      const generateButton = screen.getByRole('button', { name: /generate music/i });
      await userEvent.click(generateButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          expect.stringContaining('Generated'),
          expect.anything()
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error toast when composeMusic fails', async () => {
      mockComposeMusic.mockRejectedValue(new Error('Composition failed'));

      render(<App />);

      const generateButton = screen.getByRole('button', { name: /generate music/i });
      await userEvent.click(generateButton);

      await waitFor(() => {
        // Error messages are now user-friendly via ERROR_MESSAGES mapping
        // Unknown errors show 'An unexpected error occurred.' or the original message
        expect(mockToast.error).toHaveBeenCalled();
      });
    });

    it('shows error toast when synthesizeAudio fails', async () => {
      mockSynthesizeAudio.mockRejectedValue(new Error('Audio synthesis failed'));

      render(<App />);

      const generateButton = screen.getByRole('button', { name: /generate music/i });
      await userEvent.click(generateButton);

      await waitFor(() => {
        // With partial success handling, failed instruments trigger error toast
        expect(mockToast.error).toHaveBeenCalled();
      });
    });

    it('handles missing audioContent gracefully', async () => {
      mockSynthesizeAudio.mockResolvedValue({ mimeType: 'audio/wav', seed: 123 });

      render(<App />);

      const generateButton = screen.getByRole('button', { name: /generate music/i });
      await userEvent.click(generateButton);

      await waitFor(() => {
        // Missing audio content now triggers GenerationError with partial results
        expect(mockToast.error).toHaveBeenCalled();
      });
    });
  });

  describe('Memory Management', () => {
    it('revokes old blob URL before creating new one', async () => {
      render(<App />);

      const generateButton = screen.getByRole('button', { name: /generate music/i });

      // First generation - creates URL in App.tsx + AudioPlayer may also create
      await userEvent.click(generateButton);
      await waitFor(() => {
        expect(global.URL.createObjectURL).toHaveBeenCalled();
      });

      const createCallsAfterFirst = (global.URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.length;

      // Second generation should revoke previous URLs
      await userEvent.click(generateButton);
      await waitFor(() => {
        expect(global.URL.revokeObjectURL).toHaveBeenCalled();
        // Should have created more URLs for the second generation
        expect(global.URL.createObjectURL).toHaveBeenCalledTimes(createCallsAfterFirst * 2);
      });
    });
  });

  describe('Edge Cases', () => {
    it('skips audio generation if instruments array is empty', async () => {
      render(<App />);

      // Deselect the default erhu
      const erhuButton = screen.getByRole('button', { name: /erhu/i });
      await userEvent.click(erhuButton);

      // Button should be disabled
      const generateButton = screen.getByRole('button', { name: /generate music/i });
      expect(generateButton).toBeDisabled();
    });

    it('disables generate button during generation', async () => {
      // Make composeMusic slow to allow checking disabled state
      mockComposeMusic.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockComposition), 100))
      );

      render(<App />);

      const generateButton = screen.getByRole('button', { name: /generate music/i });
      await userEvent.click(generateButton);

      // Button should show loading state
      expect(screen.getByRole('button', { name: /composing/i })).toBeDisabled();
    });

    it('re-enables controls after generation completes', async () => {
      render(<App />);

      const generateButton = screen.getByRole('button', { name: /generate music/i });
      await userEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate music/i })).not.toBeDisabled();
      });
    });

    it('re-enables controls after generation fails', async () => {
      mockComposeMusic.mockRejectedValue(new Error('Failed'));

      render(<App />);

      const generateButton = screen.getByRole('button', { name: /generate music/i });
      await userEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate music/i })).not.toBeDisabled();
      });
    });
  });
});
