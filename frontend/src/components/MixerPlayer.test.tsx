import React, { createRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MixerPlayer } from './MixerPlayer';
import type { MixerPlayerRef } from './MixerPlayer';
import type { InstrumentAudioResult, Instrument } from '../types/music';
import { AudioError } from '../types/errors';

// Mock track state
interface MockTrackState {
    volume: number;
    muted: boolean;
}

// Create a mock for useAudioMixer hook
const createMockMixer = (overrides?: Record<string, unknown>) => ({
    isPlaying: false,
    isReady: true,
    currentTime: 0,
    duration: 60,
    tracks: new Map<Instrument, MockTrackState>(),
    failedTracks: new Map<Instrument, AudioError>(),
    hasPartialFailure: false,
    play: vi.fn(),
    pause: vi.fn(),
    togglePlay: vi.fn(),
    seek: vi.fn(),
    setTrackVolume: vi.fn(),
    toggleMute: vi.fn(),
    ...overrides,
});

let mockMixer = createMockMixer();

vi.mock('../hooks/useAudioMixer', () => ({
    useAudioMixer: vi.fn(() => mockMixer),
}));

// Helper to create mock audio results
const createMockAudioResult = (instrument: Instrument): InstrumentAudioResult => ({
    instrument,
    audioContent: 'YQ==',
    mimeType: 'audio/wav',
    seed: 12345,
});

describe('MixerPlayer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMixer = createMockMixer();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('returns null when audioResults is empty', () => {
            const { container } = render(
                <MixerPlayer audioResults={[]} />
            );

            expect(container.firstChild).toBeNull();
        });

        it('renders player when audioResults provided', () => {
            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            expect(screen.getByRole('slider')).toBeInTheDocument();
        });

        it('renders play button when not playing', () => {
            mockMixer = createMockMixer({ isPlaying: false });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            expect(screen.getByLabelText('Play')).toBeInTheDocument();
        });

        it('renders pause button when playing', () => {
            mockMixer = createMockMixer({ isPlaying: true });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            expect(screen.getByLabelText('Pause')).toBeInTheDocument();
        });

        it('renders current time display', () => {
            mockMixer = createMockMixer({ currentTime: 65 });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            expect(screen.getByText('1:05')).toBeInTheDocument();
        });

        it('renders duration display', () => {
            mockMixer = createMockMixer({ duration: 125 });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            expect(screen.getByText('2:05')).toBeInTheDocument();
        });

        it('renders progress bar with correct percentage', () => {
            mockMixer = createMockMixer({ currentTime: 30, duration: 60 });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            const slider = screen.getByRole('slider');
            expect(slider).toHaveAttribute('aria-valuenow', '50');
        });
    });

    describe('formatTime Helper', () => {
        it('formats 0 as "0:00"', () => {
            mockMixer = createMockMixer({ currentTime: 0 });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            expect(screen.getByText('0:00')).toBeInTheDocument();
        });

        it('formats 65 as "1:05"', () => {
            mockMixer = createMockMixer({ currentTime: 65 });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            expect(screen.getByText('1:05')).toBeInTheDocument();
        });

        it('formats 125 as "2:05"', () => {
            mockMixer = createMockMixer({ currentTime: 125 });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            expect(screen.getByText('2:05')).toBeInTheDocument();
        });

        it('pads seconds with leading zero', () => {
            mockMixer = createMockMixer({ currentTime: 62 });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            expect(screen.getByText('1:02')).toBeInTheDocument();
        });
    });

    describe('Play/Pause Controls', () => {
        it('calls mixer.togglePlay on button click', () => {
            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            fireEvent.click(screen.getByLabelText('Play'));

            expect(mockMixer.togglePlay).toHaveBeenCalledTimes(1);
        });

        it('has correct aria-label for play state', () => {
            mockMixer = createMockMixer({ isPlaying: false });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            expect(screen.getByLabelText('Play')).toBeInTheDocument();
        });

        it('has correct aria-label for pause state', () => {
            mockMixer = createMockMixer({ isPlaying: true });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            expect(screen.getByLabelText('Pause')).toBeInTheDocument();
        });

        it('has correct aria-pressed attribute', () => {
            mockMixer = createMockMixer({ isPlaying: true });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            const button = screen.getByLabelText('Pause');
            expect(button).toHaveAttribute('aria-pressed', 'true');
        });
    });

    describe('Progress Bar / Seek', () => {
        it('calls mixer.seek on progress bar click', () => {
            mockMixer = createMockMixer({ duration: 100 });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            const progressBar = screen.getByRole('slider');

            // Mock getBoundingClientRect
            vi.spyOn(progressBar, 'getBoundingClientRect').mockReturnValue({
                left: 0,
                width: 100,
                top: 0,
                right: 100,
                bottom: 10,
                height: 10,
                x: 0,
                y: 0,
                toJSON: () => {},
            });

            fireEvent.click(progressBar, { clientX: 50 });

            expect(mockMixer.seek).toHaveBeenCalledWith(50);
        });

        it('calculates correct seek time from click position', () => {
            mockMixer = createMockMixer({ duration: 200 });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            const progressBar = screen.getByRole('slider');

            vi.spyOn(progressBar, 'getBoundingClientRect').mockReturnValue({
                left: 100,
                width: 200,
                top: 0,
                right: 300,
                bottom: 10,
                height: 10,
                x: 100,
                y: 0,
                toJSON: () => {},
            });

            // Click at 150px (50px into the 200px bar = 25%)
            fireEvent.click(progressBar, { clientX: 150 });

            // 25% of 200s duration = 50s
            expect(mockMixer.seek).toHaveBeenCalledWith(50);
        });

        it('does not seek when duration is 0', () => {
            mockMixer = createMockMixer({ duration: 0 });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            const progressBar = screen.getByRole('slider');
            fireEvent.click(progressBar, { clientX: 50 });

            expect(mockMixer.seek).not.toHaveBeenCalled();
        });

        it('has correct aria-valuenow for progress', () => {
            mockMixer = createMockMixer({ currentTime: 25, duration: 100 });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            const slider = screen.getByRole('slider');
            expect(slider).toHaveAttribute('aria-valuenow', '25');
        });

        it('has slider role for accessibility', () => {
            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            expect(screen.getByRole('slider')).toBeInTheDocument();
        });
    });

    describe('Track Mixer Controls', () => {
        it('does not show mixer controls with single track', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            // Should not find volume sliders for tracks (only progress bar slider exists)
            const sliders = screen.getAllByRole('slider');
            expect(sliders).toHaveLength(1); // Only progress bar
        });

        it('shows mixer controls when > 1 track', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: false });
            tracks.set('guzheng', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer
                    audioResults={[
                        createMockAudioResult('erhu'),
                        createMockAudioResult('guzheng'),
                    ]}
                />
            );

            // Should find volume sliders for tracks plus progress bar
            const sliders = screen.getAllByRole('slider');
            expect(sliders.length).toBeGreaterThan(1);
        });

        it('renders volume slider per track', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 0.8, muted: false });
            tracks.set('guzheng', { volume: 0.6, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer
                    audioResults={[
                        createMockAudioResult('erhu'),
                        createMockAudioResult('guzheng'),
                    ]}
                />
            );

            expect(screen.getByLabelText('erhu volume')).toBeInTheDocument();
            expect(screen.getByLabelText('guzheng volume')).toBeInTheDocument();
        });

        it('renders mute button per track', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: false });
            tracks.set('guzheng', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer
                    audioResults={[
                        createMockAudioResult('erhu'),
                        createMockAudioResult('guzheng'),
                    ]}
                />
            );

            expect(screen.getByLabelText('Mute erhu')).toBeInTheDocument();
            expect(screen.getByLabelText('Mute guzheng')).toBeInTheDocument();
        });

        it('shows correct instrument icons', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: false });
            tracks.set('dizi', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer
                    audioResults={[
                        createMockAudioResult('erhu'),
                        createMockAudioResult('dizi'),
                    ]}
                />
            );

            expect(screen.getByText('🎻')).toBeInTheDocument(); // erhu
            expect(screen.getByText('🪈')).toBeInTheDocument(); // dizi
        });

        it('shows track names capitalized', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: false });
            tracks.set('pipa', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer
                    audioResults={[
                        createMockAudioResult('erhu'),
                        createMockAudioResult('pipa'),
                    ]}
                />
            );

            // The component uses capitalize CSS class, but text content is lowercase
            expect(screen.getByText('erhu')).toBeInTheDocument();
            expect(screen.getByText('pipa')).toBeInTheDocument();
        });
    });

    describe('Volume Control', () => {
        it('calls setTrackVolume on slider change', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: false });
            tracks.set('guzheng', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer
                    audioResults={[
                        createMockAudioResult('erhu'),
                        createMockAudioResult('guzheng'),
                    ]}
                />
            );

            const volumeSlider = screen.getByLabelText('erhu volume');
            fireEvent.change(volumeSlider, { target: { value: '0.5' } });

            expect(mockMixer.setTrackVolume).toHaveBeenCalledWith('erhu', 0.5);
        });

        it('disables volume slider when track is muted', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: true });
            tracks.set('guzheng', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer
                    audioResults={[
                        createMockAudioResult('erhu'),
                        createMockAudioResult('guzheng'),
                    ]}
                />
            );

            expect(screen.getByLabelText('erhu volume')).toBeDisabled();
            expect(screen.getByLabelText('guzheng volume')).not.toBeDisabled();
        });

        it('has correct aria-label for volume slider', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: false });
            tracks.set('guzheng', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer
                    audioResults={[
                        createMockAudioResult('erhu'),
                        createMockAudioResult('guzheng'),
                    ]}
                />
            );

            expect(screen.getByLabelText('erhu volume')).toBeInTheDocument();
        });
    });

    describe('Mute Control', () => {
        it('calls toggleMute on mute button click', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: false });
            tracks.set('guzheng', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer
                    audioResults={[
                        createMockAudioResult('erhu'),
                        createMockAudioResult('guzheng'),
                    ]}
                />
            );

            fireEvent.click(screen.getByLabelText('Mute erhu'));

            expect(mockMixer.toggleMute).toHaveBeenCalledWith('erhu');
        });

        it('shows muted icon when track is muted', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: true });
            tracks.set('guzheng', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer
                    audioResults={[
                        createMockAudioResult('erhu'),
                        createMockAudioResult('guzheng'),
                    ]}
                />
            );

            // Muted icon
            expect(screen.getByText('🔇')).toBeInTheDocument();
            // Unmuted icon
            expect(screen.getByText('🔊')).toBeInTheDocument();
        });

        it('shows unmuted icon when track is not muted', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: false });
            tracks.set('guzheng', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer
                    audioResults={[
                        createMockAudioResult('erhu'),
                        createMockAudioResult('guzheng'),
                    ]}
                />
            );

            const unmutedIcons = screen.getAllByText('🔊');
            expect(unmutedIcons).toHaveLength(2);
        });

        it('has correct aria-pressed for mute state', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: true });
            tracks.set('guzheng', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer
                    audioResults={[
                        createMockAudioResult('erhu'),
                        createMockAudioResult('guzheng'),
                    ]}
                />
            );

            expect(screen.getByLabelText('Unmute erhu')).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByLabelText('Mute guzheng')).toHaveAttribute('aria-pressed', 'false');
        });

        it('has correct aria-label for mute button', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: true });
            tracks.set('guzheng', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer
                    audioResults={[
                        createMockAudioResult('erhu'),
                        createMockAudioResult('guzheng'),
                    ]}
                />
            );

            expect(screen.getByLabelText('Unmute erhu')).toBeInTheDocument();
            expect(screen.getByLabelText('Mute guzheng')).toBeInTheDocument();
        });
    });

    describe('ForwardRef / PlaybackControls', () => {
        it('exposes controls via ref', () => {
            const ref = createRef<MixerPlayerRef>();

            render(
                <MixerPlayer
                    ref={ref}
                    audioResults={[createMockAudioResult('erhu')]}
                />
            );

            expect(ref.current).not.toBeNull();
            expect(ref.current?.controls).toBeDefined();
        });

        it('ref.controls.togglePlay calls mixer.togglePlay', () => {
            const ref = createRef<MixerPlayerRef>();

            render(
                <MixerPlayer
                    ref={ref}
                    audioResults={[createMockAudioResult('erhu')]}
                />
            );

            ref.current?.controls.togglePlay();

            expect(mockMixer.togglePlay).toHaveBeenCalledTimes(1);
        });

        it('ref.controls.seek calls mixer.seek', () => {
            const ref = createRef<MixerPlayerRef>();

            render(
                <MixerPlayer
                    ref={ref}
                    audioResults={[createMockAudioResult('erhu')]}
                />
            );

            ref.current?.controls.seek(30);

            expect(mockMixer.seek).toHaveBeenCalledWith(30);
        });

        it('ref.controls.getCurrentTime returns currentTime', () => {
            const ref = createRef<MixerPlayerRef>();
            mockMixer = createMockMixer({ currentTime: 45 });

            render(
                <MixerPlayer
                    ref={ref}
                    audioResults={[createMockAudioResult('erhu')]}
                />
            );

            expect(ref.current?.controls.getCurrentTime()).toBe(45);
        });

        it('ref.controls.getDuration returns duration', () => {
            const ref = createRef<MixerPlayerRef>();
            mockMixer = createMockMixer({ duration: 120 });

            render(
                <MixerPlayer
                    ref={ref}
                    audioResults={[createMockAudioResult('erhu')]}
                />
            );

            expect(ref.current?.controls.getDuration()).toBe(120);
        });

        it('ref.controls.isReady reflects mixer.isReady', () => {
            const ref = createRef<MixerPlayerRef>();
            mockMixer = createMockMixer({ isReady: true });

            render(
                <MixerPlayer
                    ref={ref}
                    audioResults={[createMockAudioResult('erhu')]}
                />
            );

            expect(ref.current?.controls.isReady).toBe(true);
        });
    });

    describe('onPlaybackChange Callback', () => {
        it('calls onPlaybackChange with playback state', () => {
            const onPlaybackChange = vi.fn();
            mockMixer = createMockMixer({
                isPlaying: false,
                currentTime: 10,
                duration: 60,
            });

            render(
                <MixerPlayer
                    audioResults={[createMockAudioResult('erhu')]}
                    onPlaybackChange={onPlaybackChange}
                />
            );

            expect(onPlaybackChange).toHaveBeenCalledWith({
                isPlaying: false,
                currentTime: 10,
                duration: 60,
            });
        });

        it('updates callback when isPlaying changes', () => {
            const onPlaybackChange = vi.fn();
            mockMixer = createMockMixer({ isPlaying: false });

            const { rerender } = render(
                <MixerPlayer
                    audioResults={[createMockAudioResult('erhu')]}
                    onPlaybackChange={onPlaybackChange}
                />
            );

            mockMixer = createMockMixer({ isPlaying: true });
            rerender(
                <MixerPlayer
                    audioResults={[createMockAudioResult('erhu')]}
                    onPlaybackChange={onPlaybackChange}
                />
            );

            // Last call should have isPlaying: true
            const lastCall = onPlaybackChange.mock.calls[onPlaybackChange.mock.calls.length - 1][0];
            expect(lastCall.isPlaying).toBe(true);
        });

        it('updates callback when currentTime changes', () => {
            const onPlaybackChange = vi.fn();
            mockMixer = createMockMixer({ currentTime: 0 });

            const { rerender } = render(
                <MixerPlayer
                    audioResults={[createMockAudioResult('erhu')]}
                    onPlaybackChange={onPlaybackChange}
                />
            );

            mockMixer = createMockMixer({ currentTime: 30 });
            rerender(
                <MixerPlayer
                    audioResults={[createMockAudioResult('erhu')]}
                    onPlaybackChange={onPlaybackChange}
                />
            );

            const lastCall = onPlaybackChange.mock.calls[onPlaybackChange.mock.calls.length - 1][0];
            expect(lastCall.currentTime).toBe(30);
        });

        it('updates callback when duration changes', () => {
            const onPlaybackChange = vi.fn();
            mockMixer = createMockMixer({ duration: 60 });

            const { rerender } = render(
                <MixerPlayer
                    audioResults={[createMockAudioResult('erhu')]}
                    onPlaybackChange={onPlaybackChange}
                />
            );

            mockMixer = createMockMixer({ duration: 120 });
            rerender(
                <MixerPlayer
                    audioResults={[createMockAudioResult('erhu')]}
                    onPlaybackChange={onPlaybackChange}
                />
            );

            const lastCall = onPlaybackChange.mock.calls[onPlaybackChange.mock.calls.length - 1][0];
            expect(lastCall.duration).toBe(120);
        });
    });

    describe('Ensemble Label', () => {
        it('shows ensemble label when > 1 track', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: false });
            tracks.set('guzheng', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer
                    audioResults={[
                        createMockAudioResult('erhu'),
                        createMockAudioResult('guzheng'),
                    ]}
                />
            );

            expect(screen.getByText(/Ensemble/)).toBeInTheDocument();
        });

        it('shows correct track count in label', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: false });
            tracks.set('guzheng', { volume: 1, muted: false });
            tracks.set('pipa', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer
                    audioResults={[
                        createMockAudioResult('erhu'),
                        createMockAudioResult('guzheng'),
                        createMockAudioResult('pipa'),
                    ]}
                />
            );

            expect(screen.getByText(/3 tracks/)).toBeInTheDocument();
        });

        it('hides ensemble label with single track', () => {
            const tracks = new Map<Instrument, MockTrackState>();
            tracks.set('erhu', { volume: 1, muted: false });
            mockMixer = createMockMixer({ tracks });

            render(
                <MixerPlayer audioResults={[createMockAudioResult('erhu')]} />
            );

            expect(screen.queryByText(/Ensemble/)).not.toBeInTheDocument();
        });
    });
});
