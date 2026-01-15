import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompositionHistory } from './CompositionHistory';
import type { SavedComposition } from '../hooks/useCompositionHistory';
import type { PentatonicMode } from '../types/music';

// Helper to create mock saved composition
const createMockSavedComposition = (
    id: string,
    mode: PentatonicMode = 'gong',
    createdAt?: number,
    instruments: string[] = ['erhu']
): SavedComposition => ({
    id,
    params: {
        mode,
        root: 'C',
        tempo: 72,
        instruments: instruments as SavedComposition['params']['instruments'],
        mood: 'calm',
    },
    composition: {
        scale: ['C', 'D', 'E', 'G', 'A'],
        motif: { pitches: ['C', 'E', 'G'], rhythm: [1, 0.5, 0.5] },
        form: ['A', 'B', 'A'],
        instrumentRoles: {},
        euclideanPatterns: {},
    },
    audioResults: instruments.map((inst) => ({
        instrument: inst as SavedComposition['audioResults'][0]['instrument'],
        audioContent: 'YQ==',
        mimeType: 'audio/wav',
        seed: 12345,
    })),
    createdAt: createdAt || Date.now(),
});

describe('CompositionHistory', () => {
    const mockOnSelect = vi.fn();
    const mockOnDelete = vi.fn();
    const mockOnClear = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Rendering', () => {
        it('returns null when history is empty', () => {
            const { container } = render(
                <CompositionHistory
                    history={[]}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(container.firstChild).toBeNull();
        });

        it('renders list when history has items', () => {
            const history = [createMockSavedComposition('comp_1')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('Gong Mode')).toBeInTheDocument();
        });

        it('renders "Recent Compositions" heading', () => {
            const history = [createMockSavedComposition('comp_1')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('Recent Compositions')).toBeInTheDocument();
        });

        it('renders "Clear All" button', () => {
            const history = [createMockSavedComposition('comp_1')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('Clear All')).toBeInTheDocument();
        });

        it('renders all history items', () => {
            const history = [
                createMockSavedComposition('comp_1', 'gong'),
                createMockSavedComposition('comp_2', 'shang'),
                createMockSavedComposition('comp_3', 'jue'),
            ];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('Gong Mode')).toBeInTheDocument();
            expect(screen.getByText('Shang Mode')).toBeInTheDocument();
            expect(screen.getByText('Jue Mode')).toBeInTheDocument();
        });
    });

    describe('Composition Item Display', () => {
        it('displays mode name with first letter capitalized', () => {
            const history = [createMockSavedComposition('comp_1', 'zhi')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('Zhi Mode')).toBeInTheDocument();
        });

        it('displays instruments list joined by comma', () => {
            const history = [createMockSavedComposition('comp_1', 'gong', undefined, ['erhu', 'guzheng', 'pipa'])];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('erhu, guzheng, pipa')).toBeInTheDocument();
        });

        it('displays relative time for createdAt', () => {
            const now = Date.now();
            const history = [createMockSavedComposition('comp_1', 'gong', now - 5 * 60 * 1000)];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('5m ago')).toBeInTheDocument();
        });

        it('displays mode label letter in badge', () => {
            const history = [createMockSavedComposition('comp_1', 'gong')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            // 'G' letter for gong mode
            expect(screen.getByText('G')).toBeInTheDocument();
        });
    });

    describe('formatDate Helper', () => {
        it('returns "Just now" for < 1 minute ago', () => {
            const now = Date.now();
            const history = [createMockSavedComposition('comp_1', 'gong', now - 30 * 1000)];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('Just now')).toBeInTheDocument();
        });

        it('returns "Xm ago" for < 60 minutes', () => {
            const now = Date.now();
            const history = [createMockSavedComposition('comp_1', 'gong', now - 30 * 60 * 1000)];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('30m ago')).toBeInTheDocument();
        });

        it('returns "Xh ago" for < 24 hours', () => {
            const now = Date.now();
            const history = [createMockSavedComposition('comp_1', 'gong', now - 5 * 60 * 60 * 1000)];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('5h ago')).toBeInTheDocument();
        });

        it('returns "Xd ago" for < 7 days', () => {
            const now = Date.now();
            const history = [createMockSavedComposition('comp_1', 'gong', now - 3 * 24 * 60 * 60 * 1000)];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('3d ago')).toBeInTheDocument();
        });

        it('returns toLocaleDateString for >= 7 days', () => {
            const now = Date.now();
            const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;
            const history = [createMockSavedComposition('comp_1', 'gong', tenDaysAgo)];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            // Should show a date string (format depends on locale)
            const dateStr = new Date(tenDaysAgo).toLocaleDateString();
            expect(screen.getByText(dateStr)).toBeInTheDocument();
        });
    });

    describe('getModeLabel Mapping', () => {
        it('returns G for gong', () => {
            const history = [createMockSavedComposition('comp_1', 'gong')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('G')).toBeInTheDocument();
        });

        it('returns S for shang', () => {
            const history = [createMockSavedComposition('comp_1', 'shang')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('S')).toBeInTheDocument();
        });

        it('returns J for jue', () => {
            const history = [createMockSavedComposition('comp_1', 'jue')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('J')).toBeInTheDocument();
        });

        it('returns Z for zhi', () => {
            const history = [createMockSavedComposition('comp_1', 'zhi')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('Z')).toBeInTheDocument();
        });

        it('returns Y for yu', () => {
            const history = [createMockSavedComposition('comp_1', 'yu')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('Y')).toBeInTheDocument();
        });

        it('returns ? for unknown mode', () => {
            // Create a composition with an unknown mode (cast to bypass type check)
            const history = [createMockSavedComposition('comp_1', 'unknown' as PentatonicMode)];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByText('?')).toBeInTheDocument();
        });
    });

    describe('onSelect Callback', () => {
        it('calls onSelect when item is clicked', () => {
            const history = [createMockSavedComposition('comp_1')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            fireEvent.click(screen.getByText('Gong Mode'));

            expect(mockOnSelect).toHaveBeenCalledTimes(1);
        });

        it('passes correct composition to onSelect', () => {
            const composition = createMockSavedComposition('comp_specific', 'shang');
            const history = [composition];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            fireEvent.click(screen.getByText('Shang Mode'));

            expect(mockOnSelect).toHaveBeenCalledWith(composition);
        });
    });

    describe('onDelete Callback', () => {
        it('calls onDelete when delete button is clicked', () => {
            const history = [createMockSavedComposition('comp_1')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            // Find the delete button (×)
            const deleteButton = screen.getByTitle('Delete');
            fireEvent.click(deleteButton);

            expect(mockOnDelete).toHaveBeenCalledTimes(1);
        });

        it('passes correct id to onDelete', () => {
            const history = [createMockSavedComposition('comp_to_delete')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            const deleteButton = screen.getByTitle('Delete');
            fireEvent.click(deleteButton);

            expect(mockOnDelete).toHaveBeenCalledWith('comp_to_delete');
        });

        it('stops propagation (does not trigger onSelect)', () => {
            const history = [createMockSavedComposition('comp_1')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            const deleteButton = screen.getByTitle('Delete');
            fireEvent.click(deleteButton);

            expect(mockOnDelete).toHaveBeenCalledTimes(1);
            expect(mockOnSelect).not.toHaveBeenCalled();
        });
    });

    describe('onClear Callback', () => {
        it('calls onClear when Clear All is clicked', () => {
            const history = [createMockSavedComposition('comp_1')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            fireEvent.click(screen.getByText('Clear All'));

            expect(mockOnClear).toHaveBeenCalledTimes(1);
        });
    });

    describe('Accessibility', () => {
        it('delete button has title attribute', () => {
            const history = [createMockSavedComposition('comp_1')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByTitle('Delete')).toBeInTheDocument();
        });

        it('clear button has title attribute', () => {
            const history = [createMockSavedComposition('comp_1')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            expect(screen.getByTitle('Clear history')).toBeInTheDocument();
        });

        it('items are clickable', () => {
            const history = [createMockSavedComposition('comp_1')];

            render(
                <CompositionHistory
                    history={history}
                    onSelect={mockOnSelect}
                    onDelete={mockOnDelete}
                    onClear={mockOnClear}
                />
            );

            // Find the parent row element that has the click handler (class contains cursor-pointer)
            const modeText = screen.getByText('Gong Mode');
            // Traverse up to find the clickable row (grandparent div with group class)
            const item = modeText.closest('.group');
            expect(item).toHaveClass('cursor-pointer');
        });
    });
});
