import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresetGallery } from './PresetGallery';
import { PRESETS } from '../data/presets';

describe('PresetGallery', () => {
    const mockOnSelect = vi.fn();

    beforeEach(() => {
        mockOnSelect.mockClear();
    });

    describe('rendering', () => {
        it('should render the component with header', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);
            expect(screen.getByText('Demo Compositions')).toBeInTheDocument();
        });

        it('should show preset count badge', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);
            expect(screen.getByText(String(PRESETS.length))).toBeInTheDocument();
        });

        it('should render all presets', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);
            PRESETS.forEach(preset => {
                expect(screen.getByText(preset.name)).toBeInTheDocument();
            });
        });

        it('should show preset descriptions', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);
            PRESETS.forEach(preset => {
                expect(screen.getByText(preset.description)).toBeInTheDocument();
            });
        });

        it('should render mode badges for each preset', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);
            // Check for mode label badges (G, S, J, Z, Y)
            expect(screen.getByText('G')).toBeInTheDocument(); // Gong
            expect(screen.getByText('S')).toBeInTheDocument(); // Shang
            expect(screen.getByText('J')).toBeInTheDocument(); // Jue
            expect(screen.getByText('Z')).toBeInTheDocument(); // Zhi
            expect(screen.getByText('Y')).toBeInTheDocument(); // Yu
        });

        it('should show instruction text when expanded', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);
            expect(screen.getByText('Click a preset to generate and play')).toBeInTheDocument();
        });
    });

    describe('expand/collapse', () => {
        it('should be expanded by default', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);
            expect(screen.getByRole('listbox')).toBeInTheDocument();
        });

        it('should collapse when header is clicked', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);

            const toggleButton = screen.getByRole('button', { name: /demo compositions/i });
            fireEvent.click(toggleButton);

            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        });

        it('should expand when header is clicked again', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);

            const toggleButton = screen.getByRole('button', { name: /demo compositions/i });
            fireEvent.click(toggleButton); // Collapse
            fireEvent.click(toggleButton); // Expand

            expect(screen.getByRole('listbox')).toBeInTheDocument();
        });

        it('should have correct aria-expanded attribute', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);

            const toggleButton = screen.getByRole('button', { name: /demo compositions/i });
            expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

            fireEvent.click(toggleButton);
            expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
        });
    });

    describe('selection', () => {
        it('should call onSelect when preset is clicked', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);

            const firstPreset = screen.getByText(PRESETS[0].name);
            fireEvent.click(firstPreset.closest('[role="option"]')!);

            expect(mockOnSelect).toHaveBeenCalledTimes(1);
            expect(mockOnSelect).toHaveBeenCalledWith(PRESETS[0]);
        });

        it('should call onSelect with correct preset data', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);

            // Click the second preset
            const secondPreset = screen.getByText(PRESETS[1].name);
            fireEvent.click(secondPreset.closest('[role="option"]')!);

            expect(mockOnSelect).toHaveBeenCalledWith(PRESETS[1]);
        });

        it('should support keyboard selection with Enter', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);

            const presetOption = screen.getByText(PRESETS[0].name).closest('[role="option"]')!;
            fireEvent.keyDown(presetOption, { key: 'Enter' });

            expect(mockOnSelect).toHaveBeenCalledWith(PRESETS[0]);
        });

        it('should support keyboard selection with Space', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);

            const presetOption = screen.getByText(PRESETS[0].name).closest('[role="option"]')!;
            fireEvent.keyDown(presetOption, { key: ' ' });

            expect(mockOnSelect).toHaveBeenCalledWith(PRESETS[0]);
        });
    });

    describe('disabled state', () => {
        it('should disable selection when isGenerating is true', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={true} />);

            const presetOption = screen.getByText(PRESETS[0].name).closest('[role="option"]')!;
            fireEvent.click(presetOption);

            expect(mockOnSelect).not.toHaveBeenCalled();
        });

        it('should have aria-disabled when generating', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={true} />);

            const presetOption = screen.getByText(PRESETS[0].name).closest('[role="option"]')!;
            expect(presetOption).toHaveAttribute('aria-disabled', 'true');
        });

        it('should have tabIndex -1 when generating', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={true} />);

            const presetOption = screen.getByText(PRESETS[0].name).closest('[role="option"]')!;
            expect(presetOption).toHaveAttribute('tabIndex', '-1');
        });

        it('should show reduced opacity when generating', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={true} />);

            const presetOption = screen.getByText(PRESETS[0].name).closest('[role="option"]')!;
            expect(presetOption).toHaveClass('opacity-50');
        });
    });

    describe('accessibility', () => {
        it('should have listbox role for preset container', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);
            expect(screen.getByRole('listbox')).toBeInTheDocument();
        });

        it('should have option role for each preset', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);
            const options = screen.getAllByRole('option');
            expect(options).toHaveLength(PRESETS.length);
        });

        it('should have aria-label on listbox', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);
            expect(screen.getByRole('listbox')).toHaveAttribute('aria-label', 'Demo compositions');
        });

        it('should have aria-controls on toggle button', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);
            const toggleButton = screen.getByRole('button', { name: /demo compositions/i });
            expect(toggleButton).toHaveAttribute('aria-controls', 'preset-list');
        });
    });

    describe('instrument display', () => {
        it('should show instrument abbreviations for presets', () => {
            render(<PresetGallery onSelect={mockOnSelect} isGenerating={false} />);

            // Check for instrument abbreviations (first 2 chars)
            // Mountain Dawn has erhu and guzheng
            expect(screen.getAllByText('er').length).toBeGreaterThan(0); // erhu
            expect(screen.getAllByText('gu').length).toBeGreaterThan(0); // guzheng
        });
    });
});
