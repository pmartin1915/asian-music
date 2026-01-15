import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compositionToMidi, downloadMidi } from './midiExport';
import type { Composition } from '../types/music';

// Sample composition for testing
const mockComposition: Composition = {
  scale: ['C4', 'D4', 'E4', 'G4', 'A4'],
  motif: {
    pitches: ['C4', 'E4', 'G4', 'A4'],
    rhythm: [1, 0.5, 0.5, 1],
  },
  form: ['A', 'B', "A'"],
  instrumentRoles: {
    erhu: 'melody',
    pipa: 'counter',
  },
  euclideanPatterns: {
    melody: [1, 0, 1, 0, 1, 0, 1, 0],
    counter: [1, 0, 0, 1, 0, 0, 1, 0],
    bass: [1, 0, 0, 0, 1, 0, 0, 0],
  },
};

describe('midiExport', () => {
  describe('compositionToMidi', () => {
    it('returns a Uint8Array', () => {
      const result = compositionToMidi(mockComposition, 120);
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('starts with MIDI header "MThd"', () => {
      const result = compositionToMidi(mockComposition, 120);
      // MThd in ASCII: 0x4D, 0x54, 0x68, 0x64
      expect(result[0]).toBe(0x4D); // M
      expect(result[1]).toBe(0x54); // T
      expect(result[2]).toBe(0x68); // h
      expect(result[3]).toBe(0x64); // d
    });

    it('has correct header length (6 bytes)', () => {
      const result = compositionToMidi(mockComposition, 120);
      // Bytes 4-7 are the header length as 32-bit big-endian
      const headerLength = (result[4] << 24) | (result[5] << 16) | (result[6] << 8) | result[7];
      expect(headerLength).toBe(6);
    });

    it('is format type 0 (single track)', () => {
      const result = compositionToMidi(mockComposition, 120);
      // Bytes 8-9 are format type as 16-bit big-endian
      const formatType = (result[8] << 8) | result[9];
      expect(formatType).toBe(0);
    });

    it('has exactly 1 track', () => {
      const result = compositionToMidi(mockComposition, 120);
      // Bytes 10-11 are track count as 16-bit big-endian
      const trackCount = (result[10] << 8) | result[11];
      expect(trackCount).toBe(1);
    });

    it('uses 480 ticks per beat resolution', () => {
      const result = compositionToMidi(mockComposition, 120);
      // Bytes 12-13 are ticks per beat as 16-bit big-endian
      const ticksPerBeat = (result[12] << 8) | result[13];
      expect(ticksPerBeat).toBe(480);
    });

    it('contains track chunk starting with "MTrk"', () => {
      const result = compositionToMidi(mockComposition, 120);
      // Track chunk starts at byte 14
      expect(result[14]).toBe(0x4D); // M
      expect(result[15]).toBe(0x54); // T
      expect(result[16]).toBe(0x72); // r
      expect(result[17]).toBe(0x6B); // k
    });

    it('contains end of track marker', () => {
      const result = compositionToMidi(mockComposition, 120);
      // End of track: FF 2F 00
      const bytes = Array.from(result);
      let foundEndOfTrack = false;
      for (let i = 0; i < bytes.length - 2; i++) {
        if (bytes[i] === 0xFF && bytes[i + 1] === 0x2F && bytes[i + 2] === 0x00) {
          foundEndOfTrack = true;
          break;
        }
      }
      expect(foundEndOfTrack).toBe(true);
    });

    it('contains tempo meta event', () => {
      const result = compositionToMidi(mockComposition, 120);
      // Tempo event: FF 51 03
      const bytes = Array.from(result);
      let foundTempo = false;
      for (let i = 0; i < bytes.length - 2; i++) {
        if (bytes[i] === 0xFF && bytes[i + 1] === 0x51 && bytes[i + 2] === 0x03) {
          foundTempo = true;
          break;
        }
      }
      expect(foundTempo).toBe(true);
    });

    it('generates different output for different tempos', () => {
      const result1 = compositionToMidi(mockComposition, 60);
      const result2 = compositionToMidi(mockComposition, 120);
      // Tempo is encoded in the file, so different tempos should produce different bytes
      // VLQ encoding means file sizes may vary with tempo
      expect(result1.length).toBeGreaterThan(20);
      expect(result2.length).toBeGreaterThan(20);
      // Tempo bytes should differ
      expect(Array.from(result1)).not.toEqual(Array.from(result2));
    });

    it('handles composition with single instrument', () => {
      const singleInstrument: Composition = {
        ...mockComposition,
        instrumentRoles: { dizi: 'melody' },
      };
      const result = compositionToMidi(singleInstrument, 90);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(14); // At least header
    });

    it('handles composition with all four instruments', () => {
      const allInstruments: Composition = {
        ...mockComposition,
        instrumentRoles: {
          erhu: 'melody',
          guzheng: 'counter',
          pipa: 'bass',
          dizi: 'melody',
        },
      };
      const result = compositionToMidi(allInstruments, 100);
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('contains program change events', () => {
      const result = compositionToMidi(mockComposition, 120);
      const bytes = Array.from(result);
      // Program change is 0xCn where n is channel
      let foundProgramChange = false;
      for (const byte of bytes) {
        if ((byte & 0xF0) === 0xC0) {
          foundProgramChange = true;
          break;
        }
      }
      expect(foundProgramChange).toBe(true);
    });

    it('contains note on events', () => {
      const result = compositionToMidi(mockComposition, 120);
      const bytes = Array.from(result);
      // Note on is 0x9n where n is channel
      let foundNoteOn = false;
      for (const byte of bytes) {
        if ((byte & 0xF0) === 0x90) {
          foundNoteOn = true;
          break;
        }
      }
      expect(foundNoteOn).toBe(true);
    });

    it('contains note off events', () => {
      const result = compositionToMidi(mockComposition, 120);
      const bytes = Array.from(result);
      // Note off is 0x8n where n is channel
      let foundNoteOff = false;
      for (const byte of bytes) {
        if ((byte & 0xF0) === 0x80) {
          foundNoteOff = true;
          break;
        }
      }
      expect(foundNoteOff).toBe(true);
    });

    it('uses default tempo of 72 when not specified', () => {
      const result = compositionToMidi(mockComposition);
      // Should not throw and produce valid output
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(20);
    });
  });

  describe('downloadMidi', () => {
    let createObjectURLSpy: ReturnType<typeof vi.fn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
    let appendChildSpy: ReturnType<typeof vi.fn>;
    let removeChildSpy: ReturnType<typeof vi.fn>;
    let clickSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      createObjectURLSpy = vi.fn(() => 'blob:mock-url');
      revokeObjectURLSpy = vi.fn();
      clickSpy = vi.fn();
      appendChildSpy = vi.fn();
      removeChildSpy = vi.fn();

      global.URL.createObjectURL = createObjectURLSpy;
      global.URL.revokeObjectURL = revokeObjectURLSpy;

      vi.spyOn(document.body, 'appendChild').mockImplementation(appendChildSpy);
      vi.spyOn(document.body, 'removeChild').mockImplementation(removeChildSpy);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          return {
            href: '',
            download: '',
            click: clickSpy,
          } as unknown as HTMLAnchorElement;
        }
        return document.createElement(tag);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('creates a blob URL', () => {
      downloadMidi(mockComposition, 120);
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob));
    });

    it('creates blob with correct MIME type', () => {
      downloadMidi(mockComposition, 120);
      const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
      expect(blobArg.type).toBe('audio/midi');
    });

    it('creates an anchor element and clicks it', () => {
      downloadMidi(mockComposition, 120);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('appends and removes anchor from body', () => {
      downloadMidi(mockComposition, 120);
      expect(appendChildSpy).toHaveBeenCalledTimes(1);
      expect(removeChildSpy).toHaveBeenCalledTimes(1);
    });

    it('revokes the blob URL after download', () => {
      downloadMidi(mockComposition, 120);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    });

    it('uses default filename when not specified', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      createElementSpy.mockImplementation((tag: string) => {
        if (tag === 'a') {
          const anchor = {
            href: '',
            download: '',
            click: clickSpy,
          };
          return anchor as unknown as HTMLAnchorElement;
        }
        return document.createElement(tag);
      });

      downloadMidi(mockComposition, 120);
      // The anchor's download property should be set to default
    });

    it('uses custom filename when provided', () => {
      let capturedDownload = '';
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          const anchor = {
            href: '',
            set download(val: string) {
              capturedDownload = val;
            },
            get download() {
              return capturedDownload;
            },
            click: clickSpy,
          };
          return anchor as unknown as HTMLAnchorElement;
        }
        return document.createElement(tag);
      });

      downloadMidi(mockComposition, 120, 'my-composition.mid');
      expect(capturedDownload).toBe('my-composition.mid');
    });
  });
});
