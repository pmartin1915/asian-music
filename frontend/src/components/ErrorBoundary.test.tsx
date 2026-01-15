import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

// Component that throws an error for testing
const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
        throw new Error('Test error message');
    }
    return <div>Child content</div>;
};

// Suppress console.error during tests since we expect errors
beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ErrorBoundary', () => {
    describe('Normal Rendering', () => {
        it('renders children when no error occurs', () => {
            render(
                <ErrorBoundary>
                    <div>Child content</div>
                </ErrorBoundary>
            );
            expect(screen.getByText('Child content')).toBeInTheDocument();
        });

        it('renders multiple children correctly', () => {
            render(
                <ErrorBoundary>
                    <div>First child</div>
                    <div>Second child</div>
                </ErrorBoundary>
            );
            expect(screen.getByText('First child')).toBeInTheDocument();
            expect(screen.getByText('Second child')).toBeInTheDocument();
        });
    });

    describe('Error Catching', () => {
        it('catches errors and displays default fallback UI', () => {
            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );
            expect(screen.getByText('Something went wrong')).toBeInTheDocument();
            expect(screen.queryByText('Child content')).not.toBeInTheDocument();
        });

        it('displays error message in details section', () => {
            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );
            expect(screen.getByText('Test error message')).toBeInTheDocument();
        });

        it('displays custom fallback when provided', () => {
            render(
                <ErrorBoundary fallback={<div>Custom error UI</div>}>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );
            expect(screen.getByText('Custom error UI')).toBeInTheDocument();
            expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
        });

        it('calls onError callback with error info', () => {
            const onError = vi.fn();
            render(
                <ErrorBoundary onError={onError}>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );
            expect(onError).toHaveBeenCalledTimes(1);
            expect(onError).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    componentStack: expect.any(String),
                })
            );
        });

        it('logs error to console', () => {
            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('Default Fallback UI', () => {
        it('shows warning icon', () => {
            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );
            expect(screen.getByRole('img', { name: 'Error' })).toBeInTheDocument();
        });

        it('shows helpful message', () => {
            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );
            expect(
                screen.getByText(/An unexpected error occurred/i)
            ).toBeInTheDocument();
        });

        it('shows Try Again button', () => {
            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );
            expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
        });

        it('shows Refresh Page button', () => {
            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );
            expect(screen.getByRole('button', { name: 'Refresh Page' })).toBeInTheDocument();
        });

        it('has expandable error details', () => {
            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );
            expect(screen.getByText('Error details')).toBeInTheDocument();
        });
    });

    describe('Reset Functionality', () => {
        it('resets error state when Try Again is clicked', () => {
            // Use a controllable component to simulate error then recovery
            let shouldThrow = true;
            const ControlledComponent = () => {
                if (shouldThrow) {
                    throw new Error('Test error');
                }
                return <div>Child content</div>;
            };

            const { rerender } = render(
                <ErrorBoundary>
                    <ControlledComponent />
                </ErrorBoundary>
            );

            expect(screen.getByText('Something went wrong')).toBeInTheDocument();

            // Simulate fixing the issue
            shouldThrow = false;

            // Click Try Again to reset error boundary
            fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

            // Re-render to trigger the boundary to try again
            rerender(
                <ErrorBoundary>
                    <ControlledComponent />
                </ErrorBoundary>
            );

            expect(screen.getByText('Child content')).toBeInTheDocument();
            expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
        });

        it('calls window.location.reload when Refresh Page is clicked', () => {
            const reloadMock = vi.fn();
            Object.defineProperty(window, 'location', {
                value: { reload: reloadMock },
                writable: true,
            });

            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );

            fireEvent.click(screen.getByRole('button', { name: 'Refresh Page' }));
            expect(reloadMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('Error State Management', () => {
        it('maintains error state until reset', () => {
            const { rerender } = render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );

            expect(screen.getByText('Something went wrong')).toBeInTheDocument();

            // Re-render without clicking reset - should still show error
            rerender(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={false} />
                </ErrorBoundary>
            );

            // Error state persists until reset is clicked
            expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        });
    });
});
