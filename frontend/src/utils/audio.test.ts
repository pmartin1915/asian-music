import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isValidBase64, base64ToBlob, base64ToBlobUrl, base64ToArrayBuffer } from './audio';
import { AudioError } from '../types/errors';

describe('Audio Utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isValidBase64', () => {
        it('returns true for valid base64 strings', () => {
            expect(isValidBase64('SGVsbG8=')).toBe(true);
            expect(isValidBase64('SGVsbG8gV29ybGQh')).toBe(true);
            expect(isValidBase64('YWJj')).toBe(true);
        });

        it('returns false for empty string', () => {
            expect(isValidBase64('')).toBe(false);
        });

        it('returns false for null/undefined', () => {
            expect(isValidBase64(null as unknown as string)).toBe(false);
            expect(isValidBase64(undefined as unknown as string)).toBe(false);
        });

        it('returns false when length not divisible by 4', () => {
            expect(isValidBase64('abc')).toBe(false);
            expect(isValidBase64('abcde')).toBe(false);
            expect(isValidBase64('a')).toBe(false);
        });

        it('returns false for invalid characters', () => {
            expect(isValidBase64('abc!')).toBe(false);
            expect(isValidBase64('ab@d')).toBe(false);
            expect(isValidBase64('test#ing')).toBe(false);
        });

        it('accepts padding with = or ==', () => {
            expect(isValidBase64('YQ==')).toBe(true); // 'a'
            expect(isValidBase64('YWI=')).toBe(true); // 'ab'
            expect(isValidBase64('YWJj')).toBe(true); // 'abc'
        });

        it('returns false for too much padding', () => {
            // === is not valid base64 padding
            expect(isValidBase64('a===')).toBe(false);
        });

        it('returns true for valid base64 with + and /', () => {
            expect(isValidBase64('ab+/')).toBe(true);
            expect(isValidBase64('a+b/')).toBe(true);
        });
    });

    describe('base64ToBlob', () => {
        it('creates blob from valid base64', () => {
            const base64 = 'SGVsbG8='; // 'Hello'
            const blob = base64ToBlob(base64);

            expect(blob).toBeInstanceOf(Blob);
            expect(blob.type).toBe('audio/wav');
        });

        it('sets correct mime type', () => {
            const base64 = 'SGVsbG8=';
            const blob = base64ToBlob(base64, 'audio/mp3');

            expect(blob.type).toBe('audio/mp3');
        });

        it('throws AudioError for invalid base64', () => {
            expect(() => base64ToBlob('invalid!')).toThrow(AudioError);
        });

        it('includes context in error message', () => {
            try {
                base64ToBlob('invalid!', 'audio/wav', 'erhu');
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AudioError);
                expect((error as AudioError).message).toContain('erhu');
                expect((error as AudioError).instrument).toBe('erhu');
            }
        });

        it('throws AudioError for empty string', () => {
            expect(() => base64ToBlob('')).toThrow(AudioError);
        });

        it('throws AudioError with INVALID_BASE64 code', () => {
            try {
                base64ToBlob('!!!');
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AudioError);
                expect((error as AudioError).code).toBe('INVALID_BASE64');
            }
        });
    });

    describe('base64ToBlobUrl', () => {
        it('returns blob URL for valid base64', () => {
            const base64 = 'SGVsbG8=';
            const url = base64ToBlobUrl(base64);

            expect(url).toBe('blob:mock-url');
        });

        it('calls URL.createObjectURL', () => {
            const base64 = 'SGVsbG8=';
            base64ToBlobUrl(base64);

            expect(URL.createObjectURL).toHaveBeenCalled();
        });

        it('throws AudioError for invalid input', () => {
            expect(() => base64ToBlobUrl('not valid!')).toThrow(AudioError);
        });

        it('passes context to error', () => {
            try {
                base64ToBlobUrl('bad', 'audio/wav', 'pipa');
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AudioError);
                expect((error as AudioError).instrument).toBe('pipa');
            }
        });
    });

    describe('base64ToArrayBuffer', () => {
        it('returns ArrayBuffer for valid base64', () => {
            const base64 = 'SGVsbG8='; // 'Hello'
            const buffer = base64ToArrayBuffer(base64);

            expect(buffer).toBeInstanceOf(ArrayBuffer);
            expect(buffer.byteLength).toBe(5); // 'Hello' = 5 bytes
        });

        it('buffer has correct byte length', () => {
            const base64 = 'YWJj'; // 'abc'
            const buffer = base64ToArrayBuffer(base64);

            expect(buffer.byteLength).toBe(3);
        });

        it('buffer contains correct data', () => {
            const base64 = 'YWJj'; // 'abc'
            const buffer = base64ToArrayBuffer(base64);
            const view = new Uint8Array(buffer);

            expect(view[0]).toBe(97); // 'a'
            expect(view[1]).toBe(98); // 'b'
            expect(view[2]).toBe(99); // 'c'
        });

        it('throws AudioError for invalid base64', () => {
            expect(() => base64ToArrayBuffer('!!!')).toThrow(AudioError);
        });

        it('includes context in error', () => {
            try {
                base64ToArrayBuffer('bad', 'dizi');
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(AudioError);
                expect((error as AudioError).instrument).toBe('dizi');
            }
        });

        it('returns a new buffer (not a view)', () => {
            const base64 = 'YWJj';
            const buffer1 = base64ToArrayBuffer(base64);
            const buffer2 = base64ToArrayBuffer(base64);

            // Should be different buffer instances
            expect(buffer1).not.toBe(buffer2);
        });
    });
});
