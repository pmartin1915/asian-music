import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error boundary component that catches JavaScript errors in child component tree.
 * Displays a fallback UI instead of crashing the entire app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    reset = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-[200px] flex items-center justify-center p-8">
                    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full border border-red-200">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold" role="img" aria-label="Error">
                                !
                            </span>
                            <h2 className="text-lg font-bold text-gray-800">
                                Something went wrong
                            </h2>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                            An unexpected error occurred. Please try again or refresh the page.
                        </p>
                        {this.state.error && (
                            <details className="mb-4">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                    Error details
                                </summary>
                                <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32 text-red-600">
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={this.reset}
                                className="flex-1 bg-silk-stone text-white font-medium py-2 px-4 rounded-lg hover:bg-black transition-colors"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Refresh Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
