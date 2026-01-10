import { useState, useEffect, useCallback } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { AudioPlayer } from './components/AudioPlayer';
import { MixerPlayer } from './components/MixerPlayer';
import { MathDisplay } from './components/MathDisplay';
import { GenerationProgress } from './components/GenerationProgress';
import { CompositionHistory } from './components/CompositionHistory';
import { useGeneration } from './hooks/useGeneration';
import { useCompositionHistory, type SavedComposition } from './hooks/useCompositionHistory';
import { base64ToBlobUrl } from './utils/audio';
import { getErrorMessage, isRetryableError, AudioError } from './types/errors';
import { DEFAULTS } from './config/constants';
import toast, { Toaster } from 'react-hot-toast';
import type { CompositionParams, InstrumentAudioResult, Composition } from './types/music';

interface PlaybackState {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
}

function App() {
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioResults, setAudioResults] = useState<InstrumentAudioResult[]>([]);
    const [playbackState, setPlaybackState] = useState<PlaybackState>({
        isPlaying: false,
        currentTime: 0,
        duration: 0,
    });
    const [tempo, setTempo] = useState(72);
    const [loadedComposition, setLoadedComposition] = useState<Composition | null>(null);

    const generation = useGeneration();
    const compositionHistory = useCompositionHistory();

    // Centralized blob URL cleanup
    const cleanupBlobUrl = useCallback(() => {
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
    }, [audioUrl]);

    // Cleanup blob URLs on unmount
    useEffect(() => {
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    const handleGenerate = async (params: CompositionParams) => {
        // Cleanup previous state
        cleanupBlobUrl();
        setAudioResults([]);
        setPlaybackState({ isPlaying: false, currentTime: 0, duration: 0 });
        setTempo(params.tempo ?? DEFAULTS.TEMPO);
        setLoadedComposition(null);

        try {
            const result = await generation.generate(params);

            if (!result) {
                // Generation was aborted
                return;
            }

            const { composition, audioResults: newAudioResults } = result;
            setAudioResults(newAudioResults);

            // Save to history
            if (composition && newAudioResults.length > 0) {
                compositionHistory.saveComposition(params, composition, newAudioResults);
            }

            // Handle success notification
            if (generation.failedInstruments.length > 0) {
                // Partial success - unified toast
                const success = newAudioResults.map(a => a.instrument).join(', ');
                const failed = generation.failedInstruments.join(', ');
                toast(
                    <div className="text-sm">
                        <div className="font-medium text-green-700">Generated: {success}</div>
                        <div className="text-amber-700 mt-1">Failed: {failed}</div>
                        <div className="text-gray-500 text-xs mt-1">Use the retry button below to try again</div>
                    </div>,
                    {
                        duration: 6000,
                        icon: '⚠️',
                    }
                );
            } else {
                // Full success
                const instrumentList = newAudioResults.map((a) => a.instrument).join(', ');
                toast.success(`Generated ${newAudioResults.length} track(s): ${instrumentList}`, {
                    duration: 4000,
                });
            }

            // Convert the first audio to blob URL for playback
            if (newAudioResults.length > 0) {
                try {
                    const firstAudio = newAudioResults[0];
                    const url = base64ToBlobUrl(firstAudio.audioContent, 'audio/wav', firstAudio.instrument);
                    setAudioUrl(url);
                } catch (decodeErr) {
                    console.error('[App] Decoding Error:', decodeErr);
                    const message = decodeErr instanceof AudioError
                        ? getErrorMessage(decodeErr)
                        : 'Failed to decode audio data.';

                    if (isRetryableError(decodeErr)) {
                        toast.error(
                            <div className="flex items-center gap-2">
                                <span>{message}</span>
                                <button
                                    onClick={() => {
                                        toast.dismiss();
                                        handleGenerate(params);
                                    }}
                                    className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                                >
                                    Retry
                                </button>
                            </div>,
                            { duration: 8000 }
                        );
                    } else {
                        toast.error(message, { duration: 5000 });
                    }
                }
            }
        } catch (error: unknown) {
            console.error('[App] Generation error:', error);

            const message = getErrorMessage(error);
            const retryable = isRetryableError(error);

            if (retryable) {
                toast.error(
                    <div className="flex items-center gap-2">
                        <span>{message}</span>
                        <button
                            onClick={() => {
                                toast.dismiss();
                                handleGenerate(params);
                            }}
                            className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                        >
                            Retry
                        </button>
                    </div>,
                    { duration: 8000 }
                );
            } else {
                toast.error(message, { duration: 5000 });
            }
        }
    };

    const handleRetryFailed = async () => {
        try {
            const retried = await generation.retryFailed();
            if (retried.length > 0) {
                // Add retried results to existing
                setAudioResults(prev => [...prev, ...retried]);
                toast.success(`Recovered ${retried.length} track(s): ${retried.map(r => r.instrument).join(', ')}`);
            }

            if (generation.failedInstruments.length > 0) {
                toast.error(`Still failed: ${generation.failedInstruments.join(', ')}`, {
                    duration: 4000,
                    icon: '⚠️',
                });
            }
        } catch (error) {
            console.error('[App] Retry failed:', error);
            toast.error('Retry failed. Please try again.');
        }
    };

    const handleLoadComposition = (saved: SavedComposition) => {
        // Cleanup previous blob URL
        cleanupBlobUrl();

        // Restore the saved composition state
        setAudioResults(saved.audioResults);
        setTempo(saved.params.tempo ?? DEFAULTS.TEMPO);
        setPlaybackState({ isPlaying: false, currentTime: 0, duration: 0 });
        setLoadedComposition(saved.composition);

        // Update generation state with the saved composition
        generation.reset();

        // Create blob URL for first audio
        if (saved.audioResults.length > 0) {
            try {
                const firstAudio = saved.audioResults[0];
                const url = base64ToBlobUrl(firstAudio.audioContent, 'audio/wav', firstAudio.instrument);
                setAudioUrl(url);

                toast.success(`Loaded: ${saved.params.mode} mode composition`, { duration: 2000 });
            } catch (error) {
                console.error('[App] Load error:', error);
                const message = error instanceof AudioError
                    ? getErrorMessage(error)
                    : 'Failed to load composition';
                toast.error(message);
            }
        }
    };

    // Show progress during generation OR when there are failed instruments to display
    const showProgress = generation.isGenerating ||
        (generation.status === 'complete' && generation.failedInstruments.length > 0);

    return (
        <div className="min-h-screen bg-stone-100 flex flex-col">
            <Toaster position="top-center" />

            {/* Header */}
            <header className="bg-white shadow-sm py-4 sticky top-0 z-10">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-silk-stone flex items-center gap-2">
                        <span className="text-2xl">🎵</span> Silk Road Composer
                    </h1>
                    <div className="text-xs text-gray-500 font-mono">Powered by Vertex AI</div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 pb-24 flex-grow">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Sidebar: Controls */}
                    <div className="lg:col-span-4 space-y-6">
                        <ControlPanel onGenerate={handleGenerate} isGenerating={generation.isGenerating} />

                        {/* Progress Display (shows during generation and when there are failures) */}
                        {showProgress ? (
                            <GenerationProgress
                                status={generation.status}
                                currentStep={generation.currentStep}
                                progress={generation.progress}
                                totalSteps={generation.totalSteps}
                                currentStepIndex={generation.currentStepIndex}
                                steps={generation.steps}
                                failedInstruments={generation.failedInstruments}
                            />
                        ) : (
                            <div className="bg-white p-6 rounded-lg shadow-sm text-sm text-gray-600">
                                <h3 className="font-bold text-gray-800 mb-2">How it works</h3>
                                <p className="mb-2">1. Select a pentatonic mode (e.g., Gong, Yu).</p>
                                <p className="mb-2">2. Choose your instruments and mood.</p>
                                <p>3. AI composes a structure and synthesizes audio.</p>
                            </div>
                        )}

                        {/* Retry Failed Button */}
                        {generation.canRetryFailed && !generation.isGenerating && (
                            <button
                                onClick={handleRetryFailed}
                                className="w-full bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <span>🔄</span>
                                Retry Failed Tracks ({generation.failedInstruments.length})
                            </button>
                        )}

                        {/* Composition History */}
                        <CompositionHistory
                            history={compositionHistory.history}
                            onSelect={handleLoadComposition}
                            onDelete={compositionHistory.deleteComposition}
                            onClear={compositionHistory.clearHistory}
                        />
                    </div>

                    {/* Right Content: Visualization */}
                    <div className="lg:col-span-8">
                        <MathDisplay
                            composition={generation.composition || loadedComposition}
                            tempo={tempo}
                            isPlaying={playbackState.isPlaying}
                            currentTime={playbackState.currentTime}
                        />
                    </div>
                </div>
            </main>

            {/* Footer Player - Use MixerPlayer for multi-track, AudioPlayer for single */}
            {audioResults.length > 1 ? (
                <MixerPlayer audioResults={audioResults} onPlaybackChange={setPlaybackState} />
            ) : (
                <AudioPlayer audioUrl={audioUrl} audioResults={audioResults} onPlaybackChange={setPlaybackState} />
            )}
        </div>
    );
}

export default App;
