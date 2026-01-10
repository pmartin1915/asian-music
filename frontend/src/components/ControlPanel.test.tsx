import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ControlPanel } from './ControlPanel';

describe('ControlPanel', () => {
  const mockOnGenerate = vi.fn();

  beforeEach(() => {
    mockOnGenerate.mockClear();
  });

  it('renders all form controls', () => {
    render(<ControlPanel onGenerate={mockOnGenerate} isGenerating={false} />);

    expect(screen.getByText('Composition Controls')).toBeInTheDocument();
    expect(screen.getByText('Mode (Five Elements)')).toBeInTheDocument();
    expect(screen.getByText('Root Key')).toBeInTheDocument();
    expect(screen.getByText(/Tempo:/)).toBeInTheDocument();
    expect(screen.getByText('Instruments')).toBeInTheDocument();
  });

  it('renders all pentatonic mode options', () => {
    render(<ControlPanel onGenerate={mockOnGenerate} isGenerating={false} />);

    // Check all mode options exist (options include Chinese character + name, e.g., "宫 Gong")
    expect(screen.getByRole('option', { name: /Gong/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Shang/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Jue/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Zhi/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Yu/i })).toBeInTheDocument();
  });

  it('renders all instrument buttons', () => {
    render(<ControlPanel onGenerate={mockOnGenerate} isGenerating={false} />);

    expect(screen.getByRole('button', { name: /erhu/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guzheng/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pipa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dizi/i })).toBeInTheDocument();
  });

  it('renders all mood buttons with labels', () => {
    render(<ControlPanel onGenerate={mockOnGenerate} isGenerating={false} />);

    expect(screen.getByRole('button', { name: /calm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /heroic/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /melancholic/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /festive/i })).toBeInTheDocument();
  });

  it('disables generate button when no instruments selected', async () => {
    render(<ControlPanel onGenerate={mockOnGenerate} isGenerating={false} />);

    // Erhu is selected by default, deselect it
    const erhuButton = screen.getByRole('button', { name: /erhu/i });
    await userEvent.click(erhuButton);

    const generateButton = screen.getByRole('button', { name: /generate music/i });
    expect(generateButton).toBeDisabled();
  });

  it('disables generate button when isGenerating is true', () => {
    render(<ControlPanel onGenerate={mockOnGenerate} isGenerating={true} />);

    const generateButton = screen.getByRole('button', { name: /composing/i });
    expect(generateButton).toBeDisabled();
  });

  it('calls onGenerate with correct params when form is submitted', async () => {
    render(<ControlPanel onGenerate={mockOnGenerate} isGenerating={false} />);

    // Click generate button (erhu is selected by default)
    const generateButton = screen.getByRole('button', { name: /generate music/i });
    await userEvent.click(generateButton);

    expect(mockOnGenerate).toHaveBeenCalledTimes(1);
    expect(mockOnGenerate).toHaveBeenCalledWith({
      mode: 'gong',
      root: 'C',
      tempo: 72,
      instruments: ['erhu'],
      mood: 'calm',
      seed: undefined,
    });
  });

  it('allows selecting multiple instruments', async () => {
    render(<ControlPanel onGenerate={mockOnGenerate} isGenerating={false} />);

    // Select additional instruments
    await userEvent.click(screen.getByRole('button', { name: /guzheng/i }));
    await userEvent.click(screen.getByRole('button', { name: /dizi/i }));

    // Submit
    await userEvent.click(screen.getByRole('button', { name: /generate music/i }));

    expect(mockOnGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        instruments: ['erhu', 'guzheng', 'dizi'],
      })
    );
  });

  it('allows changing mood', async () => {
    render(<ControlPanel onGenerate={mockOnGenerate} isGenerating={false} />);

    // Select heroic mood
    await userEvent.click(screen.getByRole('button', { name: /heroic/i }));

    // Submit
    await userEvent.click(screen.getByRole('button', { name: /generate music/i }));

    expect(mockOnGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        mood: 'heroic',
      })
    );
  });

  it('allows setting a seed value', async () => {
    render(<ControlPanel onGenerate={mockOnGenerate} isGenerating={false} />);

    // Enter seed value
    const seedInput = screen.getByPlaceholderText(/random if empty/i);
    await userEvent.type(seedInput, '12345');

    // Submit
    await userEvent.click(screen.getByRole('button', { name: /generate music/i }));

    expect(mockOnGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        seed: 12345,
      })
    );
  });
});
