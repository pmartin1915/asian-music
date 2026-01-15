import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import type { PlaybackControls } from './useKeyboardShortcuts';

// Helper to create mock PlaybackControls
const createMockControls = (overrides?: Partial<PlaybackControls>): PlaybackControls => ({
    togglePlay: vi.fn(),
    seek: vi.fn(),
    getCurrentTime: vi.fn(() => 30),
    getDuration: vi.fn(() => 60),
    isReady: true,
    ...overrides,
});

// Helper to dispatch keyboard events
const dispatchKeyEvent = (code: string, target?: Partial<HTMLElement>) => {
    const event = new KeyboardEvent('keydown', {
        code,
        bubbles: true,
        cancelable: true,
    });

    if (target) {
        Object.defineProperty(event, 'target', {
            value: target,
            writable: false,
        });
    }

    window.dispatchEvent(event);
    return event;
};

describe('useKeyboardShortcuts', () => {
    let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
    let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        addEventListenerSpy = vi.spyOn(window, 'addEventListener');
        removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initial Setup', () => {
        it('adds keydown listener when enabled', () => {
            const controls = createMockControls();
            renderHook(() => useKeyboardShortcuts({ controls }));

            expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        });

        it('removes keydown listener on cleanup', () => {
            const controls = createMockControls();
            const { unmount } = renderHook(() => useKeyboardShortcuts({ controls }));

            unmount();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        });

        it('does not add listener when enabled=false', () => {
            const controls = createMockControls();
            renderHook(() => useKeyboardShortcuts({ controls, enabled: false }));

            expect(addEventListenerSpy).not.toHaveBeenCalled();
        });
    });

    describe('Space Key - Toggle Play/Pause', () => {
        it('calls togglePlay on Space key', () => {
            const controls = createMockControls();
            renderHook(() => useKeyboardShortcuts({ controls }));

            dispatchKeyEvent('Space');

            expect(controls.togglePlay).toHaveBeenCalledTimes(1);
        });

        it('prevents default on Space key', () => {
            const controls = createMockControls();
            renderHook(() => useKeyboardShortcuts({ controls }));

            const event = new KeyboardEvent('keydown', {
                code: 'Space',
                bubbles: true,
                cancelable: true,
            });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            window.dispatchEvent(event);

            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        it('does not call togglePlay when controls.isReady=false', () => {
            const controls = createMockControls({ isReady: false });
            renderHook(() => useKeyboardShortcuts({ controls }));

            dispatchKeyEvent('Space');

            expect(controls.togglePlay).not.toHaveBeenCalled();
        });
    });

    describe('ArrowLeft - Seek Backward', () => {
        it('seeks backward by seekAmount (default 5s)', () => {
            const controls = createMockControls({ getCurrentTime: vi.fn(() => 30) });
            renderHook(() => useKeyboardShortcuts({ controls }));

            dispatchKeyEvent('ArrowLeft');

            expect(controls.seek).toHaveBeenCalledWith(25);
        });

        it('clamps seek to 0 when near beginning', () => {
            const controls = createMockControls({ getCurrentTime: vi.fn(() => 2) });
            renderHook(() => useKeyboardShortcuts({ controls }));

            dispatchKeyEvent('ArrowLeft');

            expect(controls.seek).toHaveBeenCalledWith(0);
        });

        it('uses custom seekAmount when provided', () => {
            const controls = createMockControls({ getCurrentTime: vi.fn(() => 30) });
            renderHook(() => useKeyboardShortcuts({ controls, seekAmount: 10 }));

            dispatchKeyEvent('ArrowLeft');

            expect(controls.seek).toHaveBeenCalledWith(20);
        });

        it('prevents default on ArrowLeft', () => {
            const controls = createMockControls();
            renderHook(() => useKeyboardShortcuts({ controls }));

            const event = new KeyboardEvent('keydown', {
                code: 'ArrowLeft',
                bubbles: true,
                cancelable: true,
            });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            window.dispatchEvent(event);

            expect(preventDefaultSpy).toHaveBeenCalled();
        });
    });

    describe('ArrowRight - Seek Forward', () => {
        it('seeks forward by seekAmount (default 5s)', () => {
            const controls = createMockControls({ getCurrentTime: vi.fn(() => 30) });
            renderHook(() => useKeyboardShortcuts({ controls }));

            dispatchKeyEvent('ArrowRight');

            expect(controls.seek).toHaveBeenCalledWith(35);
        });

        it('clamps seek to duration when near end', () => {
            const controls = createMockControls({
                getCurrentTime: vi.fn(() => 58),
                getDuration: vi.fn(() => 60),
            });
            renderHook(() => useKeyboardShortcuts({ controls }));

            dispatchKeyEvent('ArrowRight');

            expect(controls.seek).toHaveBeenCalledWith(60);
        });

        it('prevents default on ArrowRight', () => {
            const controls = createMockControls();
            renderHook(() => useKeyboardShortcuts({ controls }));

            const event = new KeyboardEvent('keydown', {
                code: 'ArrowRight',
                bubbles: true,
                cancelable: true,
            });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            window.dispatchEvent(event);

            expect(preventDefaultSpy).toHaveBeenCalled();
        });
    });

    describe('Home Key - Seek to Beginning', () => {
        it('seeks to 0 on Home key', () => {
            const controls = createMockControls({ getCurrentTime: vi.fn(() => 30) });
            renderHook(() => useKeyboardShortcuts({ controls }));

            dispatchKeyEvent('Home');

            expect(controls.seek).toHaveBeenCalledWith(0);
        });

        it('prevents default on Home', () => {
            const controls = createMockControls();
            renderHook(() => useKeyboardShortcuts({ controls }));

            const event = new KeyboardEvent('keydown', {
                code: 'Home',
                bubbles: true,
                cancelable: true,
            });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            window.dispatchEvent(event);

            expect(preventDefaultSpy).toHaveBeenCalled();
        });
    });

    describe('End Key - Seek to End', () => {
        it('seeks to duration - 1 second on End key', () => {
            const controls = createMockControls({ getDuration: vi.fn(() => 60) });
            renderHook(() => useKeyboardShortcuts({ controls }));

            dispatchKeyEvent('End');

            expect(controls.seek).toHaveBeenCalledWith(59);
        });

        it('handles short duration (clamps to 0 if duration < 1)', () => {
            const controls = createMockControls({ getDuration: vi.fn(() => 0.5) });
            renderHook(() => useKeyboardShortcuts({ controls }));

            dispatchKeyEvent('End');

            expect(controls.seek).toHaveBeenCalledWith(0);
        });

        it('prevents default on End', () => {
            const controls = createMockControls();
            renderHook(() => useKeyboardShortcuts({ controls }));

            const event = new KeyboardEvent('keydown', {
                code: 'End',
                bubbles: true,
                cancelable: true,
            });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            window.dispatchEvent(event);

            expect(preventDefaultSpy).toHaveBeenCalled();
        });
    });

    describe('Input Field Exclusion', () => {
        it('ignores shortcuts when target is INPUT', () => {
            const controls = createMockControls();
            renderHook(() => useKeyboardShortcuts({ controls }));

            dispatchKeyEvent('Space', { tagName: 'INPUT' });

            expect(controls.togglePlay).not.toHaveBeenCalled();
        });

        it('ignores shortcuts when target is TEXTAREA', () => {
            const controls = createMockControls();
            renderHook(() => useKeyboardShortcuts({ controls }));

            dispatchKeyEvent('Space', { tagName: 'TEXTAREA' });

            expect(controls.togglePlay).not.toHaveBeenCalled();
        });

        it('ignores shortcuts when target is SELECT', () => {
            const controls = createMockControls();
            renderHook(() => useKeyboardShortcuts({ controls }));

            dispatchKeyEvent('Space', { tagName: 'SELECT' });

            expect(controls.togglePlay).not.toHaveBeenCalled();
        });

        it('ignores shortcuts when target isContentEditable', () => {
            const controls = createMockControls();
            renderHook(() => useKeyboardShortcuts({ controls }));

            dispatchKeyEvent('Space', { tagName: 'DIV', isContentEditable: true });

            expect(controls.togglePlay).not.toHaveBeenCalled();
        });
    });

    describe('Disabled State', () => {
        it('ignores shortcuts when enabled=false', () => {
            const controls = createMockControls();
            renderHook(() => useKeyboardShortcuts({ controls, enabled: false }));

            dispatchKeyEvent('Space');

            expect(controls.togglePlay).not.toHaveBeenCalled();
        });

        it('ignores shortcuts when controls is null', () => {
            renderHook(() => useKeyboardShortcuts({ controls: null }));

            // Should not throw
            expect(() => dispatchKeyEvent('Space')).not.toThrow();
        });

        it('ignores shortcuts when controls.isReady=false', () => {
            const controls = createMockControls({ isReady: false });
            renderHook(() => useKeyboardShortcuts({ controls }));

            dispatchKeyEvent('Space');
            dispatchKeyEvent('ArrowLeft');
            dispatchKeyEvent('ArrowRight');
            dispatchKeyEvent('Home');
            dispatchKeyEvent('End');

            expect(controls.togglePlay).not.toHaveBeenCalled();
            expect(controls.seek).not.toHaveBeenCalled();
        });

        it('responds to shortcuts when re-enabled', () => {
            const controls = createMockControls();
            const { rerender } = renderHook(
                ({ enabled }) => useKeyboardShortcuts({ controls, enabled }),
                { initialProps: { enabled: false } }
            );

            dispatchKeyEvent('Space');
            expect(controls.togglePlay).not.toHaveBeenCalled();

            rerender({ enabled: true });
            dispatchKeyEvent('Space');
            expect(controls.togglePlay).toHaveBeenCalledTimes(1);
        });
    });

    describe('Unrecognized Keys', () => {
        it('does not call any control for unrecognized keys', () => {
            const controls = createMockControls();
            renderHook(() => useKeyboardShortcuts({ controls }));

            dispatchKeyEvent('KeyA');
            dispatchKeyEvent('Enter');
            dispatchKeyEvent('Escape');

            expect(controls.togglePlay).not.toHaveBeenCalled();
            expect(controls.seek).not.toHaveBeenCalled();
        });

        it('does not prevent default for unrecognized keys', () => {
            const controls = createMockControls();
            renderHook(() => useKeyboardShortcuts({ controls }));

            const event = new KeyboardEvent('keydown', {
                code: 'KeyA',
                bubbles: true,
                cancelable: true,
            });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            window.dispatchEvent(event);

            expect(preventDefaultSpy).not.toHaveBeenCalled();
        });
    });
});
