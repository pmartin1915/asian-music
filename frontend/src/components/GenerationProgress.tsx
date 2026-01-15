import React from 'react';
import type { JobStatus } from '../types/music';

interface GenerationStep {
    name: string;
    status: 'pending' | 'active' | 'complete' | 'error';
}

interface GenerationProgressProps {
    status: JobStatus;
    currentStep: string;
    progress: number;
    totalSteps: number;
    currentStepIndex: number;
    steps?: GenerationStep[];
    failedInstruments?: string[];
    onCancel?: () => void;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
    status,
    currentStep,
    progress,
    totalSteps,
    currentStepIndex,
    steps = [],
    failedInstruments = [],
    onCancel,
}) => {
    // Show component if generating OR if there are failed instruments to show
    const hasFailedSteps = steps.some(s => s.status === 'error') || failedInstruments.length > 0;

    if ((status === 'complete' || status === 'error') && !hasFailedSteps) {
        return null;
    }

    // When complete with failures, show a summary instead of active progress
    const isCompletedWithFailures = status === 'complete' && hasFailedSteps;

    const getStatusIcon = () => {
        if (isCompletedWithFailures) return '!';
        switch (status) {
            case 'composing':
                return 'C';
            case 'synthesizing':
                return 'S';
            case 'error':
                return 'X';
            default:
                return '...';
        }
    };

    const getStatusColor = () => {
        if (isCompletedWithFailures) return 'bg-amber-500';
        switch (status) {
            case 'composing':
                return 'bg-silk-amber';
            case 'synthesizing':
                return 'bg-silk-red';
            case 'error':
                return 'bg-red-500';
            default:
                return 'bg-gray-400';
        }
    };

    const getBorderColor = () => {
        if (isCompletedWithFailures) return 'border-amber-500';
        if (status === 'error') return 'border-red-500';
        return 'border-silk-amber';
    };

    // Get step status, with fallback to index-based logic
    const getStepStatus = (index: number): GenerationStep['status'] => {
        if (steps[index]) {
            return steps[index].status;
        }
        // Fallback for when steps aren't provided
        if (index < currentStepIndex) return 'complete';
        if (index === currentStepIndex) return 'active';
        return 'pending';
    };

    const getStepIndicator = (stepStatus: GenerationStep['status'], index: number) => {
        switch (stepStatus) {
            case 'complete':
                return '✓';
            case 'error':
                return '✗';
            case 'active':
                return index + 1;
            default:
                return index + 1;
        }
    };

    const getStepClasses = (stepStatus: GenerationStep['status']) => {
        switch (stepStatus) {
            case 'complete':
                return 'bg-silk-amber text-white';
            case 'error':
                return 'bg-red-500 text-white';
            case 'active':
                return 'bg-silk-red text-white animate-pulse';
            default:
                return 'bg-gray-200 text-gray-400';
        }
    };

    const getTextClasses = (stepStatus: GenerationStep['status']) => {
        switch (stepStatus) {
            case 'complete':
                return 'text-silk-amber';
            case 'error':
                return 'text-red-500';
            case 'active':
                return 'text-silk-red';
            default:
                return 'text-gray-300';
        }
    };

    const getStepLabel = (index: number): string => {
        const stepName = steps[index]?.name || `Step ${index + 1}`;
        const stepStatus = getStepStatus(index);
        const statusLabel = stepStatus === 'complete' ? 'completed' :
            stepStatus === 'error' ? 'failed' :
            stepStatus === 'active' ? 'in progress' : 'pending';
        return `${stepName}, ${statusLabel}`;
    };

    const isGenerating = status === 'composing' || status === 'synthesizing';

    // Screen reader announcement text
    const getStatusAnnouncement = (): string => {
        if (isCompletedWithFailures) {
            return `Generation complete with ${failedInstruments.length} failed track${failedInstruments.length > 1 ? 's' : ''}`;
        }
        if (status === 'error') {
            return 'Generation failed';
        }
        return `${currentStep}, ${Math.round(progress)}% complete`;
    };

    return (
        <div
            className={`bg-white rounded-lg shadow-lg p-6 border-l-4 ${getBorderColor()}`}
            role="region"
            aria-label="Generation progress"
        >
            {/* Screen reader status announcement */}
            <div
                role="status"
                aria-live={status === 'error' ? 'assertive' : 'polite'}
                aria-atomic="true"
                className="sr-only"
            >
                {getStatusAnnouncement()}
            </div>

            <div className="flex items-center gap-3 mb-4">
                <span
                    className={`text-2xl ${status !== 'complete' && status !== 'error' ? 'animate-pulse' : ''}`}
                    aria-hidden="true"
                >
                    {getStatusIcon()}
                </span>
                <div className="flex-1">
                    <h3 className="font-bold text-silk-stone">{currentStep}</h3>
                    <p className="text-sm text-gray-500">
                        {isCompletedWithFailures
                            ? `${failedInstruments.length} track(s) failed`
                            : `Step ${currentStepIndex + 1} of ${totalSteps}`
                        }
                    </p>
                </div>
                {/* Cancel button */}
                {isGenerating && onCancel && (
                    <button
                        onClick={onCancel}
                        className="px-3 py-1 text-sm text-gray-500 hover:text-silk-red hover:bg-red-50 rounded transition-colors"
                        aria-label="Cancel generation"
                    >
                        Cancel
                    </button>
                )}
            </div>

            {/* Overall Progress Bar */}
            <div className="mb-2">
                <div
                    className="h-2 bg-gray-200 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Generation progress: ${Math.round(progress)}%`}
                >
                    <div
                        className={`h-full ${getStatusColor()} transition-all duration-500 ease-out`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Step Indicators */}
            <div
                className="flex justify-between mt-4"
                role="list"
                aria-label="Generation steps"
            >
                {Array.from({ length: totalSteps }).map((_, i) => {
                    const stepStatus = getStepStatus(i);
                    return (
                        <div
                            key={i}
                            role="listitem"
                            className={`flex flex-col items-center ${getTextClasses(stepStatus)}`}
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getStepClasses(stepStatus)}`}
                                aria-label={getStepLabel(i)}
                            >
                                {getStepIndicator(stepStatus, i)}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Failed instruments list when complete with failures */}
            {isCompletedWithFailures && failedInstruments.length > 0 && (
                <div className="mt-4 text-sm text-red-600">
                    <span className="font-medium">Failed: </span>
                    {failedInstruments.map(inst => inst.charAt(0).toUpperCase() + inst.slice(1)).join(', ')}
                </div>
            )}
        </div>
    );
};
