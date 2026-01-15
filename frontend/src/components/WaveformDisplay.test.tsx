import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WaveformDisplay, extractWaveformData, decodeAndExtractWaveform } from './WaveformDisplay';

// Mock canvas context
const mockFillRect = vi.fn();
const mockBeginPath = vi.fn();
const mockMoveTo = vi.fn();
const mockLineTo = vi.fn();
const mockStroke = vi.fn();

const mockContext = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  fillRect: mockFillRect,
  beginPath: mockBeginPath,
  moveTo: mockMoveTo,
  lineTo: mockLineTo,
  stroke: mockStroke,
};

beforeEach(() => {
  vi.clearAllMocks();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

describe('WaveformDisplay', () => {
  describe('Rendering', () => {
    it('returns null when audioData is null', () => {
      const { container } = render(
        <WaveformDisplay
          audioData={null}
          currentTime={0}
          duration={60}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders canvas when audioData is provided', () => {
      const audioData = new Float32Array([0, 0.5, -0.5, 0.3, -0.3]);
      render(
        <WaveformDisplay
          audioData={audioData}
          currentTime={0}
          duration={60}
        />
      );
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('has correct aria-label for accessibility', () => {
      const audioData = new Float32Array([0, 0.5, -0.5]);
      render(
        <WaveformDisplay
          audioData={audioData}
          currentTime={0}
          duration={60}
        />
      );
      expect(screen.getByRole('img')).toHaveAttribute(
        'aria-label',
        'Audio waveform visualization'
      );
    });

    it('applies rounded-lg class to canvas', () => {
      const audioData = new Float32Array([0, 0.5, -0.5]);
      render(
        <WaveformDisplay
          audioData={audioData}
          currentTime={0}
          duration={60}
        />
      );
      expect(screen.getByRole('img')).toHaveClass('rounded-lg');
    });
  });

  describe('Canvas dimensions', () => {
    it('uses default width of 600', () => {
      const audioData = new Float32Array([0, 0.5]);
      render(
        <WaveformDisplay
          audioData={audioData}
          currentTime={0}
          duration={60}
        />
      );
      const canvas = screen.getByRole('img') as HTMLCanvasElement;
      expect(canvas.width).toBe(600);
    });

    it('uses default height of 80', () => {
      const audioData = new Float32Array([0, 0.5]);
      render(
        <WaveformDisplay
          audioData={audioData}
          currentTime={0}
          duration={60}
        />
      );
      const canvas = screen.getByRole('img') as HTMLCanvasElement;
      expect(canvas.height).toBe(80);
    });

    it('uses custom width when provided', () => {
      const audioData = new Float32Array([0, 0.5]);
      render(
        <WaveformDisplay
          audioData={audioData}
          currentTime={0}
          duration={60}
          width={800}
        />
      );
      const canvas = screen.getByRole('img') as HTMLCanvasElement;
      expect(canvas.width).toBe(800);
    });

    it('uses custom height when provided', () => {
      const audioData = new Float32Array([0, 0.5]);
      render(
        <WaveformDisplay
          audioData={audioData}
          currentTime={0}
          duration={60}
          height={120}
        />
      );
      const canvas = screen.getByRole('img') as HTMLCanvasElement;
      expect(canvas.height).toBe(120);
    });
  });

  describe('Drawing behavior', () => {
    it('gets 2d context from canvas', () => {
      const audioData = new Float32Array([0, 0.5, -0.5]);
      render(
        <WaveformDisplay
          audioData={audioData}
          currentTime={0}
          duration={60}
        />
      );
      expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d');
    });

    it('clears canvas with background color', () => {
      const audioData = new Float32Array([0, 0.5, -0.5]);
      render(
        <WaveformDisplay
          audioData={audioData}
          currentTime={0}
          duration={60}
        />
      );
      // First fillRect call should be the background clear
      expect(mockFillRect).toHaveBeenCalled();
    });

    it('draws waveform bars', () => {
      const audioData = new Float32Array(1200); // More samples than width
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(i * 0.1);
      }
      render(
        <WaveformDisplay
          audioData={audioData}
          currentTime={0}
          duration={60}
          width={600}
        />
      );
      // Should have multiple fillRect calls for waveform bars
      expect(mockFillRect.mock.calls.length).toBeGreaterThan(1);
    });

    it('draws playhead when currentTime > 0', () => {
      const audioData = new Float32Array([0, 0.5, -0.5, 0.3]);
      render(
        <WaveformDisplay
          audioData={audioData}
          currentTime={30}
          duration={60}
        />
      );
      // Should draw playhead line
      expect(mockBeginPath).toHaveBeenCalled();
      expect(mockMoveTo).toHaveBeenCalled();
      expect(mockLineTo).toHaveBeenCalled();
      expect(mockStroke).toHaveBeenCalled();
    });

    it('does not draw playhead line at start', () => {
      const audioData = new Float32Array([0, 0.5, -0.5, 0.3]);
      render(
        <WaveformDisplay
          audioData={audioData}
          currentTime={0}
          duration={60}
        />
      );
      // progressX would be 0, so no playhead line
      expect(mockStroke).not.toHaveBeenCalled();
    });
  });

  describe('Progress calculation', () => {
    it('handles zero duration gracefully', () => {
      const audioData = new Float32Array([0, 0.5, -0.5]);
      // Should not throw
      expect(() =>
        render(
          <WaveformDisplay
            audioData={audioData}
            currentTime={10}
            duration={0}
          />
        )
      ).not.toThrow();
    });

    it('calculates correct progress position at midpoint', () => {
      const audioData = new Float32Array([0, 0.5, -0.5, 0.3]);
      render(
        <WaveformDisplay
          audioData={audioData}
          currentTime={30}
          duration={60}
          width={600}
        />
      );
      // At 50% progress (30/60), playhead should be at x=300
      // Check moveTo was called with x position around 300
      const moveToCall = mockMoveTo.mock.calls[0];
      expect(moveToCall[0]).toBeCloseTo(300, 0);
    });
  });

  describe('Custom colors', () => {
    it('accepts custom waveColor', () => {
      const audioData = new Float32Array([0, 0.5, -0.5]);
      // Should not throw with custom color
      expect(() =>
        render(
          <WaveformDisplay
            audioData={audioData}
            currentTime={0}
            duration={60}
            waveColor="#ff0000"
          />
        )
      ).not.toThrow();
    });

    it('accepts custom progressColor', () => {
      const audioData = new Float32Array([0, 0.5, -0.5]);
      expect(() =>
        render(
          <WaveformDisplay
            audioData={audioData}
            currentTime={30}
            duration={60}
            progressColor="#00ff00"
          />
        )
      ).not.toThrow();
    });

    it('accepts custom backgroundColor', () => {
      const audioData = new Float32Array([0, 0.5, -0.5]);
      expect(() =>
        render(
          <WaveformDisplay
            audioData={audioData}
            currentTime={0}
            duration={60}
            backgroundColor="#000000"
          />
        )
      ).not.toThrow();
    });
  });
});

describe('extractWaveformData', () => {
  it('extracts mono channel data unchanged', () => {
    const mockBuffer = {
      numberOfChannels: 1,
      length: 4,
      getChannelData: vi.fn(() => new Float32Array([0.1, 0.2, 0.3, 0.4])),
    } as unknown as AudioBuffer;

    const result = extractWaveformData(mockBuffer);

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(4);
    expect(result[0]).toBeCloseTo(0.1);
    expect(result[1]).toBeCloseTo(0.2);
    expect(result[2]).toBeCloseTo(0.3);
    expect(result[3]).toBeCloseTo(0.4);
  });

  it('mixes stereo channels to mono', () => {
    const leftChannel = new Float32Array([1.0, 0.5, 0.0, -0.5]);
    const rightChannel = new Float32Array([0.0, 0.5, 1.0, -0.5]);

    const mockBuffer = {
      numberOfChannels: 2,
      length: 4,
      getChannelData: vi.fn((channel: number) =>
        channel === 0 ? leftChannel : rightChannel
      ),
    } as unknown as AudioBuffer;

    const result = extractWaveformData(mockBuffer);

    expect(result.length).toBe(4);
    // (1.0 + 0.0) / 2 = 0.5
    expect(result[0]).toBeCloseTo(0.5);
    // (0.5 + 0.5) / 2 = 0.5
    expect(result[1]).toBeCloseTo(0.5);
    // (0.0 + 1.0) / 2 = 0.5
    expect(result[2]).toBeCloseTo(0.5);
    // (-0.5 + -0.5) / 2 = -0.5
    expect(result[3]).toBeCloseTo(-0.5);
  });

  it('handles multi-channel audio (surround)', () => {
    const mockBuffer = {
      numberOfChannels: 4,
      length: 2,
      getChannelData: vi.fn(() => new Float32Array([1.0, 1.0])),
    } as unknown as AudioBuffer;

    const result = extractWaveformData(mockBuffer);

    expect(result.length).toBe(2);
    // Each channel contributes 1.0, divided by 4 channels, summed 4 times = 1.0
    expect(result[0]).toBeCloseTo(1.0);
  });

  it('returns Float32Array of correct length', () => {
    const mockBuffer = {
      numberOfChannels: 2,
      length: 1000,
      getChannelData: vi.fn(() => new Float32Array(1000)),
    } as unknown as AudioBuffer;

    const result = extractWaveformData(mockBuffer);

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(1000);
  });
});

describe('decodeAndExtractWaveform', () => {
  it('decodes base64 and extracts waveform', async () => {
    // Simple base64 encoded data
    const base64Audio = btoa('test audio data');

    const mockAudioBuffer = {
      numberOfChannels: 1,
      length: 100,
      getChannelData: vi.fn(() => new Float32Array(100).fill(0.5)),
    };

    const mockAudioContext = {
      decodeAudioData: vi.fn().mockResolvedValue(mockAudioBuffer),
    } as unknown as AudioContext;

    const result = await decodeAndExtractWaveform(base64Audio, mockAudioContext);

    expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(100);
  });

  it('passes ArrayBuffer to decodeAudioData', async () => {
    const base64Audio = btoa('test');

    const mockAudioBuffer = {
      numberOfChannels: 1,
      length: 10,
      getChannelData: vi.fn(() => new Float32Array(10)),
    };

    const mockAudioContext = {
      decodeAudioData: vi.fn().mockResolvedValue(mockAudioBuffer),
    } as unknown as AudioContext;

    await decodeAndExtractWaveform(base64Audio, mockAudioContext);

    const callArg = mockAudioContext.decodeAudioData.mock.calls[0][0];
    expect(callArg).toBeInstanceOf(ArrayBuffer);
  });

  it('rejects when decodeAudioData fails', async () => {
    const base64Audio = btoa('invalid audio');

    const mockAudioContext = {
      decodeAudioData: vi.fn().mockRejectedValue(new Error('Decode failed')),
    } as unknown as AudioContext;

    await expect(
      decodeAndExtractWaveform(base64Audio, mockAudioContext)
    ).rejects.toThrow('Decode failed');
  });
});
