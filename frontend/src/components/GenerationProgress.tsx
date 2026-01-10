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
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
    status,
    currentStep,
    progress,
    totalSteps,
    currentStepIndex,
    steps = [],
    failedInstruments = [],
}) => {
    // Show component if generating OR if there are failed instruments to show
    const hasFailedSteps = steps.some(s => s.status === 'error') || failedInstruments.length > 0;

    if ((status === 'complete' || status === 'error') && !hasFailedSteps) {
        return null;
    }

    // When complete with failures, show a summary instead of active progress
    const isCompletedWithFailures = status === 'complete' && hasFailedSteps;

    const getStatusIcon = () => {
        if (isCompletedWithFailures) return '⚠️';
        switch (status) {
            case 'composing':
                return '🎼';
            case 'synthesizing':
                return '🎵';
            case 'error':
                return '❌';
            default:
                return '⏳';
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

    return (
        <div className={`bg-white rounded-lg shadow-lg p-6 border-l-4 ${getBorderColor()}`}>
            <div className="flex items-center gap-3 mb-4">
                <span className={`text-2xl ${status !== 'complete' && status !== 'error' ? 'animate-pulse' : ''}`}>
                    {getStatusIcon()}
                </span>
                <div>
                    <h3 className="font-bold text-silk-stone">{currentStep}</h3>
                    <p className="text-sm text-gray-500">
                        {isCompletedWithFailures
                            ? `${failedInstruments.length} track(s) failed`
                            : `Step ${currentStepIndex + 1} of ${totalSteps}`
                        }
                    </p>
                </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="mb-2">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${getStatusColor()} transition-all duration-500 ease-out`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Step Indicators */}
            <div className="flex justify-between mt-4">
                {Array.from({ length: totalSteps }).map((_, i) => {
                    const stepStatus = getStepStatus(i);
                    return (
                        <div
                            key={i}
                            className={`flex flex-col items-center ${getTextClasses(stepStatus)}`}
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getStepClasses(stepStatus)}`}
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
