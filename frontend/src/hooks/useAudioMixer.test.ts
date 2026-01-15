import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AudioError } from '../types/errors';
import type { InstrumentAudioResult, Instrument } from '../types/music';

// Helper to create mock audio results
const createMockAudioResult = (
    instrument: Instrument,
    audioContent: string = 'SGVsbG8gV29ybGQh'
): InstrumentAudioResult => ({
    instrument,
    audioContent,
    mimeType: 'audio/wav',
    seed: 12345,
});

// Create mocks
const mockGainNode = {
    connect: vi.fn(),
    gain: { value: 1 },
};

const mockSourceNode = {
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null,
};

const mockAudioContext = {
    createGain: vi.fn(() => ({ ...mockGainNode })),
    createBufferSource: vi.fn(() => ({ ...mockSourceNode })),
    decodeAudioData: vi.fn().mockResolvedValue({
        duration: 60,
        numberOfChannels: 2,
        sampleRate: 44100,
    }),
    destination: {},
    currentTime: 0,
    state: 'running' as AudioContextState,
    resume: vi.fn().mockResolvedValue(undefined),
};

// Mock modules before importing the hook
vi.mock('../utils/audioContext', () => ({
    getAudioContext: vi.fn(() => mockAudioContext),
}));

vi.mock('../utils/audio', () => ({
    base64ToArrayBuffer: vi.fn(() => new ArrayBuffer(8)),
}));

import { useAudioMixer } from './useAudioMixer';
import { getAudioContext } from '../utils/audioContext';
import { base64ToArrayBuffer } from '../utils/audio';

const mockedGetAudioContext = vi.mocked(getAudioContext);
const mockedBase64ToArrayBuffer = vi.mocked(base64ToArrayBuffer);

describe('useAudioMixer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedGetAudioContext.mockReturnValue(mockAudioContext as unknown as AudioContext);
        mockedBase64ToArrayBuffer.mockReturnValue(new ArrayBuffer(8));
        mockAudioContext.decodeAudioData.mockResolvedValue({
            duration: 60,
            numberOfChannels: 2,
            sampleRate: 44100,
        });
        mockAudioContext.state = 'running';

        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initial State', () => {
        it('returns initial state with empty tracks', () => {
            const { result } = renderHook(() => useAudioMixer([]));

            expect(result.current.isPlaying).toBe(false);
            expect(result.current.currentTime).toBe(0);
            expect(result.current.duration).toBe(0);
            expect(result.current.tracks.size).toBe(0);
            expect(result.current.isReady).toBe(false);
        });

        it('provides playback control functions', () => {
            const { result } = renderHook(() => useAudioMixer([]));

            expect(typeof result.current.play).toBe('function');
            expect(typeof result.current.pause).toBe('function');
            expect(typeof result.current.togglePlay).toBe('function');
            expect(typeof result.current.seek).toBe('function');
            expect(typeof result.current.setTrackVolume).toBe('function');
            expect(typeof result.current.toggleMute).toBe('function');
        });
    });

    describe('Audio Initialization', () => {
        it('initializes tracks from audio results', async () => {
            const { result } = renderHook(() => useAudioMixer([createMockAudioResult('erhu')]));

            await waitFor(() => {
                expect(result.current.tracks.size).toBe(1);
                expect(result.current.isReady).toBe(true);
            });
        });

        it('sets duration from decoded audio', async () => {
            const { result } = renderHook(() => useAudioMixer([createMockAudioResult('erhu')]));

            await waitFor(() => {
                expect(result.current.duration).toBe(60);
            });
        });

        it('initializes tracks with default volume and unmuted', async () => {
            const { result } = renderHook(() => useAudioMixer([createMockAudioResult('erhu')]));

            await waitFor(() => {
                expect(result.current.tracks.size).toBe(1);
            });

            const track = result.current.tracks.get('erhu');
            expect(track?.volume).toBe(1);
            expect(track?.muted).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('handles AudioContext creation failure', async () => {
            mockedGetAudioContext.mockImplementation(() => {
                throw new Error('AudioContext not supported');
            });

            const { result } = renderHook(() => useAudioMixer([createMockAudioResult('erhu')]));

            await waitFor(() => {
                expect(result.current.failedTracks.size).toBe(1);
            });

            const error = result.current.failedTracks.get('erhu');
            expect(error).toBeInstanceOf(AudioError);
            expect(error?.code).toBe('CONTEXT_ERROR');
        });

        it('continues with other tracks when one fails', async () => {
            mockAudioContext.decodeAudioData
                .mockRejectedValueOnce(new Error('Decode failed'))
                .mockResolvedValueOnce({ duration: 60 });

            const { result } = renderHook(() => useAudioMixer([
                createMockAudioResult('erhu'),
                createMockAudioResult('guzheng'),
            ]));

            await waitFor(() => {
                expect(result.current.tracks.size).toBe(1);
                expect(result.current.failedTracks.size).toBe(1);
            });

            expect(result.current.hasPartialFailure).toBe(true);
        });
    });

    describe('Playback Controls', () => {
        it('starts playback with play()', async () => {
            const { result } = renderHook(() => useAudioMixer([createMockAudioResult('erhu')]));

            await waitFor(() => expect(result.current.isReady).toBe(true));

            act(() => {
                result.current.play();
            });

            expect(result.current.isPlaying).toBe(true);
        });

        it('stops playback with pause()', async () => {
            const { result } = renderHook(() => useAudioMixer([createMockAudioResult('erhu')]));

            await waitFor(() => expect(result.current.isReady).toBe(true));

            act(() => {
                result.current.play();
            });
            act(() => {
                result.current.pause();
            });

            expect(result.current.isPlaying).toBe(false);
        });

        it('toggles playback with togglePlay()', async () => {
            const { result } = renderHook(() => useAudioMixer([createMockAudioResult('erhu')]));

            await waitFor(() => expect(result.current.isReady).toBe(true));

            act(() => {
                result.current.togglePlay();
            });
            expect(result.current.isPlaying).toBe(true);

            act(() => {
                result.current.togglePlay();
            });
            expect(result.current.isPlaying).toBe(false);
        });
    });

    describe('Seek', () => {
        it('updates currentTime when seeking', async () => {
            const { result } = renderHook(() => useAudioMixer([createMockAudioResult('erhu')]));

            await waitFor(() => expect(result.current.isReady).toBe(true));

            act(() => {
                result.current.seek(30);
            });

            expect(result.current.currentTime).toBe(30);
        });

        it('clamps seek to valid range', async () => {
            const { result } = renderHook(() => useAudioMixer([createMockAudioResult('erhu')]));

            await waitFor(() => expect(result.current.isReady).toBe(true));

            act(() => {
                result.current.seek(-10);
            });
            expect(result.current.currentTime).toBe(0);

            act(() => {
                result.current.seek(100);
            });
            expect(result.current.currentTime).toBe(60);
        });
    });

    describe('Volume Control', () => {
        it('sets track volume', async () => {
            const { result } = renderHook(() => useAudioMixer([createMockAudioResult('erhu')]));

            await waitFor(() => expect(result.current.isReady).toBe(true));

            act(() => {
                result.current.setTrackVolume('erhu', 0.5);
            });

            expect(result.current.tracks.get('erhu')?.volume).toBe(0.5);
        });

        it('clamps volume to [0, 1]', async () => {
            const { result } = renderHook(() => useAudioMixer([createMockAudioResult('erhu')]));

            await waitFor(() => expect(result.current.isReady).toBe(true));

            act(() => {
                result.current.setTrackVolume('erhu', -0.5);
            });
            expect(result.current.tracks.get('erhu')?.volume).toBe(0);

            act(() => {
                result.current.setTrackVolume('erhu', 1.5);
            });
            expect(result.current.tracks.get('erhu')?.volume).toBe(1);
        });
    });

    describe('Mute Control', () => {
        it('toggles mute state', async () => {
            const { result } = renderHook(() => useAudioMixer([createMockAudioResult('erhu')]));

            await waitFor(() => expect(result.current.isReady).toBe(true));

            expect(result.current.tracks.get('erhu')?.muted).toBe(false);

            act(() => {
                result.current.toggleMute('erhu');
            });
            expect(result.current.tracks.get('erhu')?.muted).toBe(true);

            act(() => {
                result.current.toggleMute('erhu');
            });
            expect(result.current.tracks.get('erhu')?.muted).toBe(false);
        });
    });

    describe('hasPartialFailure', () => {
        it('is false when all tracks succeed', async () => {
            const { result } = renderHook(() => useAudioMixer([
                createMockAudioResult('erhu'),
                createMockAudioResult('guzheng'),
            ]));

            await waitFor(() => expect(result.current.tracks.size).toBe(2));

            expect(result.current.hasPartialFailure).toBe(false);
        });

        it('is false when all tracks fail', async () => {
            mockAudioContext.decodeAudioData.mockRejectedValue(new Error('fail'));

            const { result } = renderHook(() => useAudioMixer([
                createMockAudioResult('erhu'),
                createMockAudioResult('guzheng'),
            ]));

            await waitFor(() => {
                expect(result.current.failedTracks.size).toBe(2);
            });

            expect(result.current.hasPartialFailure).toBe(false);
        });
    });
});
