import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioPlayer } from './AudioPlayer';

describe('AudioPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('returns null when audioUrl is null', () => {
      const { container } = render(<AudioPlayer audioUrl={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders player controls when audioUrl is provided', () => {
      render(<AudioPlayer audioUrl="blob:test-url" />);

      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
    });

    it('shows play button initially', () => {
      render(<AudioPlayer audioUrl="blob:test-url" />);

      const playButton = screen.getByRole('button');
      expect(playButton).toHaveTextContent('▶');
    });

    it('renders audio element with correct src', () => {
      const { container } = render(<AudioPlayer audioUrl="blob:test-url" />);

      const audioElement = container.querySelector('audio');
      expect(audioElement).toBeInTheDocument();
      expect(audioElement).toHaveAttribute('src', 'blob:test-url');
    });
  });

  describe('Play/Pause Controls', () => {
    it('toggles to pause icon when play is clicked', () => {
      const { container } = render(<AudioPlayer audioUrl="blob:test-url" />);

      // Mock the audio element's play method
      const audioElement = container.querySelector('audio') as HTMLAudioElement;
      audioElement.play = vi.fn().mockResolvedValue(undefined);

      const playButton = screen.getByRole('button');
      fireEvent.click(playButton);

      expect(playButton).toHaveTextContent('⏸');
    });

    it('toggles back to play icon when pause is clicked', () => {
      const { container } = render(<AudioPlayer audioUrl="blob:test-url" />);

      const audioElement = container.querySelector('audio') as HTMLAudioElement;
      audioElement.play = vi.fn().mockResolvedValue(undefined);
      audioElement.pause = vi.fn();

      const button = screen.getByRole('button');

      // Click to play
      fireEvent.click(button);
      expect(button).toHaveTextContent('⏸');

      // Click to pause
      fireEvent.click(button);
      expect(button).toHaveTextContent('▶');
    });

    it('does not toggle when audioUrl is missing after click', () => {
      const { container, rerender } = render(<AudioPlayer audioUrl="blob:test-url" />);

      const audioElement = container.querySelector('audio') as HTMLAudioElement;
      audioElement.play = vi.fn().mockResolvedValue(undefined);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Simulate audioUrl becoming null (edge case)
      rerender(<AudioPlayer audioUrl={null} />);

      // Component should return null
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Progress Bar', () => {
    it('renders progress bar with initial 0% width', () => {
      const { container } = render(<AudioPlayer audioUrl="blob:test-url" />);

      const progressBar = container.querySelector('.bg-silk-amber');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('updates progress bar during playback via onTimeUpdate', () => {
      const { container } = render(<AudioPlayer audioUrl="blob:test-url" />);

      const audioElement = container.querySelector('audio') as HTMLAudioElement;

      // Simulate audio playback at 50%
      Object.defineProperty(audioElement, 'currentTime', { value: 50, writable: true });
      Object.defineProperty(audioElement, 'duration', { value: 100, writable: true });

      fireEvent.timeUpdate(audioElement);

      const progressBar = container.querySelector('.bg-silk-amber');
      expect(progressBar).toHaveStyle({ width: '50%' });
    });

    it('handles zero duration gracefully (prevents NaN)', () => {
      const { container } = render(<AudioPlayer audioUrl="blob:test-url" />);

      const audioElement = container.querySelector('audio') as HTMLAudioElement;

      // Simulate zero duration (which would cause division by zero)
      Object.defineProperty(audioElement, 'currentTime', { value: 0, writable: true });
      Object.defineProperty(audioElement, 'duration', { value: 0, writable: true });

      fireEvent.timeUpdate(audioElement);

      const progressBar = container.querySelector('.bg-silk-amber');
      // Should default to 0% and not NaN
      expect(progressBar).toHaveStyle({ width: '0%' });
    });
  });

  describe('Audio Events', () => {
    it('resets state when audio ends via onEnded', () => {
      const { container } = render(<AudioPlayer audioUrl="blob:test-url" />);

      const audioElement = container.querySelector('audio') as HTMLAudioElement;
      audioElement.play = vi.fn().mockResolvedValue(undefined);

      const button = screen.getByRole('button');

      // Start playing
      fireEvent.click(button);
      expect(button).toHaveTextContent('⏸');

      // Simulate audio ending
      fireEvent.ended(audioElement);

      // Should reset to play state
      expect(button).toHaveTextContent('▶');

      // Progress should reset
      const progressBar = container.querySelector('.bg-silk-amber');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('loads new audio when audioUrl changes', () => {
      const { container, rerender } = render(<AudioPlayer audioUrl="blob:first-url" />);

      const audioElement = container.querySelector('audio') as HTMLAudioElement;
      audioElement.load = vi.fn();
      audioElement.play = vi.fn().mockResolvedValue(undefined);

      // Start playing
      fireEvent.click(screen.getByRole('button'));

      // Change the audio URL
      rerender(<AudioPlayer audioUrl="blob:second-url" />);

      // Audio element should update src
      expect(audioElement).toHaveAttribute('src', 'blob:second-url');
    });
  });

  describe('Download Link', () => {
    it('has correct href pointing to audioUrl', () => {
      render(<AudioPlayer audioUrl="blob:test-url" />);

      const downloadLink = screen.getByText('Download');
      expect(downloadLink).toHaveAttribute('href', 'blob:test-url');
    });

    it('has correct download filename', () => {
      render(<AudioPlayer audioUrl="blob:test-url" />);

      const downloadLink = screen.getByText('Download');
      // When no audioResults, uses 'composition' as default
      expect(downloadLink).toHaveAttribute('download', 'silk-road-composition.wav');
    });

    it('uses instrument name in download filename when audioResults provided', () => {
      // Use minimal base64 content ('a' = 'YQ==')
      const audioResults = [{ audioContent: 'YQ==', mimeType: 'audio/wav', seed: 123, instrument: 'erhu' as const }];
      render(<AudioPlayer audioUrl="blob:test-url" audioResults={audioResults} />);

      const downloadLink = screen.getByText('Download');
      expect(downloadLink).toHaveAttribute('download', 'silk-road-erhu.wav');
    });

    it('download link is accessible', () => {
      render(<AudioPlayer audioUrl="blob:test-url" />);

      const downloadLink = screen.getByRole('link', { name: /download/i });
      expect(downloadLink).toBeInTheDocument();
    });
  });

  describe('Multi-Track Support', () => {
    // Use minimal base64 content to avoid memory issues in tests
    const mockAudioResults = [
      { audioContent: 'YQ==', mimeType: 'audio/wav', seed: 123, instrument: 'erhu' as const },
      { audioContent: 'Yg==', mimeType: 'audio/wav', seed: 456, instrument: 'guzheng' as const },
    ];

    it('shows track selector buttons when multiple audio results provided', () => {
      render(<AudioPlayer audioUrl="blob:test-url" audioResults={mockAudioResults} />);

      expect(screen.getByRole('button', { name: /erhu/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /guzheng/i })).toBeInTheDocument();
    });

    it('does not show track selector with single audio result', () => {
      const singleResult = [mockAudioResults[0]];
      render(<AudioPlayer audioUrl="blob:test-url" audioResults={singleResult} />);

      // Should not have track selector buttons (only play button)
      expect(screen.queryByRole('button', { name: /erhu/i })).not.toBeInTheDocument();
    });

    it('highlights the current track button', () => {
      render(<AudioPlayer audioUrl="blob:test-url" audioResults={mockAudioResults} />);

      const erhuButton = screen.getByRole('button', { name: /erhu/i });
      expect(erhuButton).toHaveClass('bg-silk-stone');
    });

    it('switches tracks when track button is clicked', () => {
      render(<AudioPlayer audioUrl="blob:test-url" audioResults={mockAudioResults} />);

      const guzhengButton = screen.getByRole('button', { name: /guzheng/i });
      fireEvent.click(guzhengButton);

      // Guzheng should now be highlighted
      expect(guzhengButton).toHaveClass('bg-silk-stone');

      // Download should reflect new track
      const downloadLink = screen.getByText('Download');
      expect(downloadLink).toHaveAttribute('download', 'silk-road-guzheng.wav');
    });

    it('shows current track label when multiple tracks', () => {
      render(<AudioPlayer audioUrl="blob:test-url" audioResults={mockAudioResults} />);

      // Should show the current instrument name
      expect(screen.getByText('erhu')).toBeInTheDocument();
    });
  });
});
