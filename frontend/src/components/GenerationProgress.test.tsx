import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GenerationProgress } from './GenerationProgress';

// Helper to create step arrays
const createSteps = (statuses: Array<'pending' | 'active' | 'complete' | 'error'>) =>
    statuses.map((status, i) => ({ name: `Step ${i + 1}`, status }));

describe('GenerationProgress', () => {
    describe('Visibility Logic', () => {
        it('returns null when status is complete with no failures', () => {
            const { container } = render(
                <GenerationProgress
                    status="complete"
                    currentStep="Complete"
                    progress={100}
                    totalSteps={2}
                    currentStepIndex={1}
                    steps={createSteps(['complete', 'complete'])}
                    failedInstruments={[]}
                />
            );
            expect(container.firstChild).toBeNull();
        });

        it('renders when status is complete but has failed instruments', () => {
            render(
                <GenerationProgress
                    status="complete"
                    currentStep="Partial Success"
                    progress={100}
                    totalSteps={3}
                    currentStepIndex={2}
                    steps={createSteps(['complete', 'complete', 'error'])}
                    failedInstruments={['erhu']}
                />
            );
            expect(screen.getByText('Partial Success')).toBeInTheDocument();
        });

        it('renders when status is complete with error steps but no failedInstruments array', () => {
            render(
                <GenerationProgress
                    status="complete"
                    currentStep="Partial Success"
                    progress={100}
                    totalSteps={2}
                    currentStepIndex={1}
                    steps={createSteps(['complete', 'error'])}
                />
            );
            expect(screen.getByText('Partial Success')).toBeInTheDocument();
        });
    });

    describe('Completed With Failures State', () => {
        it('shows warning icon when completed with failures', () => {
            render(
                <GenerationProgress
                    status="complete"
                    currentStep="Partial Success"
                    progress={100}
                    totalSteps={3}
                    currentStepIndex={2}
                    steps={createSteps(['complete', 'complete', 'error'])}
                    failedInstruments={['pipa']}
                />
            );
            expect(screen.getByText('⚠️')).toBeInTheDocument();
        });

        it('shows failure count in subtitle', () => {
            render(
                <GenerationProgress
                    status="complete"
                    currentStep="Partial Success"
                    progress={100}
                    totalSteps={4}
                    currentStepIndex={3}
                    steps={createSteps(['complete', 'complete', 'error', 'error'])}
                    failedInstruments={['erhu', 'dizi']}
                />
            );
            expect(screen.getByText('2 track(s) failed')).toBeInTheDocument();
        });

        it('applies amber border styling', () => {
            const { container } = render(
                <GenerationProgress
                    status="complete"
                    currentStep="Partial Success"
                    progress={100}
                    totalSteps={2}
                    currentStepIndex={1}
                    steps={createSteps(['complete', 'error'])}
                    failedInstruments={['guzheng']}
                />
            );
            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass('border-amber-500');
        });

        it('applies amber progress bar color', () => {
            const { container } = render(
                <GenerationProgress
                    status="complete"
                    currentStep="Partial Success"
                    progress={100}
                    totalSteps={2}
                    currentStepIndex={1}
                    steps={createSteps(['complete', 'error'])}
                    failedInstruments={['erhu']}
                />
            );
            const progressBar = container.querySelector('.bg-amber-500');
            expect(progressBar).toBeInTheDocument();
        });
    });

    describe('Failed Instruments Display', () => {
        it('displays failed instrument names with capitalization', () => {
            render(
                <GenerationProgress
                    status="complete"
                    currentStep="Partial Success"
                    progress={100}
                    totalSteps={3}
                    currentStepIndex={2}
                    steps={createSteps(['complete', 'complete', 'error'])}
                    failedInstruments={['erhu', 'pipa']}
                />
            );
            expect(screen.getByText(/Failed:/)).toBeInTheDocument();
            expect(screen.getByText(/Erhu, Pipa/)).toBeInTheDocument();
        });

        it('does not show failed list when failedInstruments is empty', () => {
            render(
                <GenerationProgress
                    status="synthesizing"
                    currentStep="Synthesizing erhu"
                    progress={50}
                    totalSteps={2}
                    currentStepIndex={1}
                    steps={createSteps(['complete', 'active'])}
                    failedInstruments={[]}
                />
            );
            expect(screen.queryByText(/Failed:/)).not.toBeInTheDocument();
        });

        it('shows single failed instrument correctly', () => {
            render(
                <GenerationProgress
                    status="complete"
                    currentStep="Partial Success"
                    progress={100}
                    totalSteps={2}
                    currentStepIndex={1}
                    steps={createSteps(['complete', 'error'])}
                    failedInstruments={['dizi']}
                />
            );
            expect(screen.getByText(/Dizi/)).toBeInTheDocument();
        });
    });

    describe('Error Step Indicators', () => {
        it('shows X symbol for error steps', () => {
            render(
                <GenerationProgress
                    status="complete"
                    currentStep="Partial Success"
                    progress={100}
                    totalSteps={3}
                    currentStepIndex={2}
                    steps={createSteps(['complete', 'error', 'complete'])}
                    failedInstruments={['guzheng']}
                />
            );
            expect(screen.getByText('✗')).toBeInTheDocument();
        });

        it('shows checkmark for completed steps', () => {
            render(
                <GenerationProgress
                    status="complete"
                    currentStep="Partial Success"
                    progress={100}
                    totalSteps={2}
                    currentStepIndex={1}
                    steps={createSteps(['complete', 'error'])}
                    failedInstruments={['erhu']}
                />
            );
            expect(screen.getByText('✓')).toBeInTheDocument();
        });

        it('applies red styling to error step indicators', () => {
            const { container } = render(
                <GenerationProgress
                    status="complete"
                    currentStep="Partial Success"
                    progress={100}
                    totalSteps={2}
                    currentStepIndex={1}
                    steps={createSteps(['complete', 'error'])}
                    failedInstruments={['pipa']}
                />
            );
            const errorIndicator = container.querySelector('.bg-red-500.text-white');
            expect(errorIndicator).toBeInTheDocument();
        });
    });

    describe('Active Generation State', () => {
        it('renders during active composing status', () => {
            render(
                <GenerationProgress
                    status="composing"
                    currentStep="Composing structure"
                    progress={25}
                    totalSteps={4}
                    currentStepIndex={0}
                    steps={createSteps(['active', 'pending', 'pending', 'pending'])}
                />
            );
            expect(screen.getByText('Composing structure')).toBeInTheDocument();
            expect(screen.getByText('🎼')).toBeInTheDocument();
        });

        it('renders during active synthesizing status', () => {
            render(
                <GenerationProgress
                    status="synthesizing"
                    currentStep="Synthesizing erhu"
                    progress={50}
                    totalSteps={4}
                    currentStepIndex={1}
                    steps={createSteps(['complete', 'active', 'pending', 'pending'])}
                />
            );
            expect(screen.getByText('Synthesizing erhu')).toBeInTheDocument();
            expect(screen.getByText('🎵')).toBeInTheDocument();
        });

        it('shows step X of Y during active generation', () => {
            render(
                <GenerationProgress
                    status="synthesizing"
                    currentStep="Synthesizing guzheng"
                    progress={75}
                    totalSteps={4}
                    currentStepIndex={2}
                    steps={createSteps(['complete', 'complete', 'active', 'pending'])}
                />
            );
            expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
        });
    });

    describe('Progress Bar', () => {
        it('renders progress bar with correct width percentage', () => {
            const { container } = render(
                <GenerationProgress
                    status="synthesizing"
                    currentStep="Synthesizing erhu"
                    progress={75}
                    totalSteps={4}
                    currentStepIndex={2}
                    steps={createSteps(['complete', 'complete', 'active', 'pending'])}
                />
            );
            const progressBar = container.querySelector('[style*="width: 75%"]');
            expect(progressBar).toBeInTheDocument();
        });

        it('shows 100% progress when complete with failures', () => {
            const { container } = render(
                <GenerationProgress
                    status="complete"
                    currentStep="Partial Success"
                    progress={100}
                    totalSteps={2}
                    currentStepIndex={1}
                    steps={createSteps(['complete', 'error'])}
                    failedInstruments={['erhu']}
                />
            );
            const progressBar = container.querySelector('[style*="width: 100%"]');
            expect(progressBar).toBeInTheDocument();
        });
    });

    describe('Default Props', () => {
        it('handles missing failedInstruments prop gracefully', () => {
            render(
                <GenerationProgress
                    status="synthesizing"
                    currentStep="Synthesizing erhu"
                    progress={50}
                    totalSteps={2}
                    currentStepIndex={1}
                />
            );
            expect(screen.getByText('Synthesizing erhu')).toBeInTheDocument();
        });

        it('handles missing steps prop with fallback logic', () => {
            render(
                <GenerationProgress
                    status="synthesizing"
                    currentStep="Synthesizing erhu"
                    progress={50}
                    totalSteps={2}
                    currentStepIndex={1}
                />
            );
            // First step should show checkmark (complete), second shows number (active)
            expect(screen.getByText('✓')).toBeInTheDocument();
        });
    });
});
