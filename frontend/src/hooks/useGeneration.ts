import { useState, useCallback, useRef } from 'react';
import { composeMusic, generateAudio } from '../services/api';
import { ApiError, GenerationError } from '../types/errors';
import type {
    CompositionParams,
    Composition,
    InstrumentAudioResult,
    JobStatus,
} from '../types/music';

interface GenerationStep {
    name: string;
    status: 'pending' | 'active' | 'complete' | 'error';
}

interface GenerationState {
    status: JobStatus;
    currentStep: string;
    progress: number;
    steps: GenerationStep[];
    currentStepIndex: number;
    composition: Composition | null;
    audioResults: InstrumentAudioResult[];
    error: ApiError | GenerationError | null;
    failedInstruments: string[];
    canRetryFailed: boolean;
}

const initialState: GenerationState = {
    status: 'pending',
    currentStep: '',
    progress: 0,
    steps: [],
    currentStepIndex: 0,
    composition: null,
    audioResults: [],
    error: null,
    failedInstruments: [],
    canRetryFailed: false,
};

export const useGeneration = () => {
    const [state, setState] = useState<GenerationState>(initialState);
    const [isGenerating, setIsGenerating] = useState(false);
    const abortRef = useRef(false);
    const lastParamsRef = useRef<CompositionParams | null>(null);

    const reset = useCallback(() => {
        setState(initialState);
        setIsGenerating(false);
        abortRef.current = false;
    }, []);

    const abort = useCallback(() => {
        abortRef.current = true;
    }, []);

    const generate = useCallback(async (params: CompositionParams): Promise<{
        composition: Composition | null;
        audioResults: InstrumentAudioResult[];
    } | null> => {
        // Reset state
        abortRef.current = false;
        setIsGenerating(true);
        lastParamsRef.current = params;

        // Build step list: compose + each instrument
        const steps: GenerationStep[] = [
            { name: 'Composing structure', status: 'pending' },
            ...params.instruments.map((inst) => ({
                name: `Synthesizing ${inst}`,
                status: 'pending' as const,
            })),
        ];

        const totalSteps = steps.length;

        setState({
            ...initialState,
            status: 'composing',
            currentStep: steps[0].name,
            steps: steps.map((s, i) => ({
                ...s,
                status: i === 0 ? 'active' : 'pending',
            })),
            currentStepIndex: 0,
            progress: 0,
        });

        try {
            // Step 1: Compose
            const composition = await composeMusic(params);

            if (abortRef.current) {
                reset();
                return null;
            }

            // Update to step complete
            setState((prev) => ({
                ...prev,
                composition,
                steps: prev.steps.map((s, i) => ({
                    ...s,
                    status: i === 0 ? 'complete' : s.status,
                })),
                progress: (1 / totalSteps) * 100,
            }));

            // Step 2+: Generate audio for each instrument with partial success handling
            const audioResults: InstrumentAudioResult[] = [];
            const failedInstruments: string[] = [];

            for (let i = 0; i < params.instruments.length; i++) {
                if (abortRef.current) {
                    reset();
                    return null;
                }

                const instrument = params.instruments[i];
                const stepIndex = i + 1;

                setState((prev) => ({
                    ...prev,
                    status: 'synthesizing',
                    currentStep: `Synthesizing ${instrument}`,
                    currentStepIndex: stepIndex,
                    steps: prev.steps.map((s, idx) => ({
                        ...s,
                        status:
                            idx < stepIndex
                                ? 'complete'
                                : idx === stepIndex
                                ? 'active'
                                : 'pending',
                    })),
                }));

                try {
                    // generateAudio already validates audioContent and throws ApiError if missing
                    const audioResult = await generateAudio(composition, instrument, params);

                    audioResults.push({
                        ...audioResult,
                        instrument,
                    });

                    setState((prev) => ({
                        ...prev,
                        audioResults: [...prev.audioResults, { ...audioResult, instrument }],
                        progress: ((stepIndex + 1) / totalSteps) * 100,
                        steps: prev.steps.map((s, idx) => ({
                            ...s,
                            status: idx <= stepIndex ? 'complete' : s.status,
                        })),
                    }));
                } catch (instrumentError) {
                    // Track failure but continue to next instrument
                    failedInstruments.push(instrument);

                    setState((prev) => ({
                        ...prev,
                        progress: ((stepIndex + 1) / totalSteps) * 100,
                        steps: prev.steps.map((s, idx) => ({
                            ...s,
                            status: idx === stepIndex ? 'error' : s.status,
                        })),
                    }));

                    console.error(`[Generation] ${instrument} failed:`, instrumentError);
                }
            }

            // Determine final status based on success/failure
            if (audioResults.length === 0) {
                // All instruments failed
                const error = new GenerationError(
                    'All instruments failed to generate',
                    'GENERATION_FAILED',
                    true,
                    { composition, successfulInstruments: [], failedInstruments }
                );

                setState((prev) => ({
                    ...prev,
                    status: 'error',
                    currentStep: 'Error',
                    error,
                    failedInstruments,
                    canRetryFailed: true,
                }));

                setIsGenerating(false);
                throw error;
            }

            if (failedInstruments.length > 0) {
                // Partial success - some instruments succeeded
                setState((prev) => ({
                    ...prev,
                    status: 'complete',
                    currentStep: 'Partial Success',
                    progress: 100,
                    failedInstruments,
                    canRetryFailed: true,
                }));
            } else {
                // Full success
                setState((prev) => ({
                    ...prev,
                    status: 'complete',
                    currentStep: 'Complete',
                    progress: 100,
                    failedInstruments: [],
                    canRetryFailed: false,
                }));
            }

            setIsGenerating(false);
            return { composition, audioResults };

        } catch (error) {
            // Typed error handling
            const typedError = error instanceof ApiError || error instanceof GenerationError
                ? error
                : new ApiError(
                    error instanceof Error ? error.message : 'Generation failed',
                    'UNKNOWN',
                    false
                );

            setState((prev) => ({
                ...prev,
                status: 'error',
                currentStep: 'Error',
                error: typedError,
                steps: prev.steps.map((s) => ({
                    ...s,
                    status: s.status === 'active' ? 'error' : s.status,
                })),
            }));

            setIsGenerating(false);
            throw typedError;
        }
    }, [reset]);

    /**
     * Retry only the failed instruments without re-composing.
     * Uses the existing composition and params from the last generation.
     */
    const retryFailed = useCallback(async (): Promise<InstrumentAudioResult[]> => {
        const composition = state.composition;
        const params = lastParamsRef.current;

        if (!composition || !params || state.failedInstruments.length === 0) {
            return [];
        }

        setIsGenerating(true);
        const retried: InstrumentAudioResult[] = [];
        const stillFailed: string[] = [];

        for (const instrument of state.failedInstruments) {
            if (abortRef.current) {
                break;
            }

            setState((prev) => ({
                ...prev,
                currentStep: `Retrying ${instrument}`,
            }));

            try {
                // generateAudio already validates audioContent and throws ApiError if missing
                const result = await generateAudio(composition, instrument, params);
                retried.push({ ...result, instrument: instrument as InstrumentAudioResult['instrument'] });
            } catch {
                stillFailed.push(instrument);
            }
        }

        setState((prev) => ({
            ...prev,
            audioResults: [...prev.audioResults, ...retried],
            failedInstruments: stillFailed,
            canRetryFailed: stillFailed.length > 0,
            currentStep: stillFailed.length > 0 ? 'Partial Success' : 'Complete',
            status: 'complete',
        }));

        setIsGenerating(false);
        return retried;
    }, [state.composition, state.failedInstruments]);

    return {
        ...state,
        isGenerating,
        generate,
        reset,
        abort,
        retryFailed,
        totalSteps: state.steps.length,
    };
};
