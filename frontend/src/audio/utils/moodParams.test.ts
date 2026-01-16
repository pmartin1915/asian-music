/**
 * Unit tests for mood-specific synthesis parameters.
 */

import { describe, it, expect } from 'vitest';
import {
    INSTRUMENT_BASE_PARAMS,
    MOOD_MODIFIERS,
    getVoiceParams,
    ROLE_VELOCITY,
    ROLE_OCTAVE_OFFSET,
    getTempoScaledAttack,
    rhythmToDuration,
    INSTRUMENT_PAN,
    INSTRUMENT_GAIN
} from './moodParams';
import type { Instrument, Mood } from '../../types/music';

describe('moodParams.ts', () => {

    describe('INSTRUMENT_BASE_PARAMS', () => {
        const instruments: Instrument[] = ['erhu', 'guzheng', 'pipa', 'dizi'];

        it('has parameters for all instruments', () => {
            instruments.forEach(instrument => {
                expect(INSTRUMENT_BASE_PARAMS[instrument]).toBeDefined();
            });
        });

        it('has required base properties for each instrument', () => {
            instruments.forEach(instrument => {
                const params = INSTRUMENT_BASE_PARAMS[instrument];
                expect(params.filterCutoff).toBeGreaterThan(0);
                expect(params.filterResonance).toBeGreaterThan(0);
                expect(params.envelope).toBeDefined();
                expect(params.envelope.attack).toBeGreaterThanOrEqual(0);
                expect(params.envelope.decay).toBeGreaterThanOrEqual(0);
                expect(params.envelope.sustain).toBeGreaterThanOrEqual(0);
                expect(params.envelope.sustain).toBeLessThanOrEqual(1);
                expect(params.envelope.release).toBeGreaterThanOrEqual(0);
            });
        });

        it('has vibrato params for bowed instruments', () => {
            expect(INSTRUMENT_BASE_PARAMS.erhu.vibratoRate).toBeDefined();
            expect(INSTRUMENT_BASE_PARAMS.erhu.vibratoDepth).toBeDefined();
        });

        it('has decay/brightness for plucked instruments', () => {
            expect(INSTRUMENT_BASE_PARAMS.guzheng.decayTime).toBeDefined();
            expect(INSTRUMENT_BASE_PARAMS.guzheng.brightness).toBeDefined();
            expect(INSTRUMENT_BASE_PARAMS.pipa.decayTime).toBeDefined();
        });

        it('has breath params for wind instruments', () => {
            expect(INSTRUMENT_BASE_PARAMS.dizi.breathiness).toBeDefined();
            expect(INSTRUMENT_BASE_PARAMS.dizi.membraneBuzz).toBeDefined();
        });
    });

    describe('MOOD_MODIFIERS', () => {
        const moods: Mood[] = ['calm', 'heroic', 'melancholic', 'festive'];

        it('has modifiers for all moods', () => {
            moods.forEach(mood => {
                expect(MOOD_MODIFIERS[mood]).toBeDefined();
            });
        });

        it('calm mood has lower filter cutoff', () => {
            expect(MOOD_MODIFIERS.calm.filterCutoff).toBeLessThan(3000);
        });

        it('heroic mood has higher filter cutoff', () => {
            expect(MOOD_MODIFIERS.heroic.filterCutoff).toBeGreaterThan(4000);
        });

        it('festive mood has fastest attack', () => {
            expect(MOOD_MODIFIERS.festive.envelope?.attack).toBeLessThan(0.05);
        });

        it('melancholic mood has longer release', () => {
            expect(MOOD_MODIFIERS.melancholic.envelope?.release).toBeGreaterThan(0.3);
        });
    });

    describe('getVoiceParams', () => {
        const instruments: Instrument[] = ['erhu', 'guzheng', 'pipa', 'dizi'];
        const moods: Mood[] = ['calm', 'heroic', 'melancholic', 'festive'];

        it('returns combined params for all instrument/mood combinations', () => {
            instruments.forEach(instrument => {
                moods.forEach(mood => {
                    const params = getVoiceParams(instrument, mood);
                    expect(params).toBeDefined();
                    expect(params.filterCutoff).toBeGreaterThan(0);
                    expect(params.envelope).toBeDefined();
                });
            });
        });

        it('merges mood modifiers over base params', () => {
            const params = getVoiceParams('erhu', 'calm');
            // Calm mood should override filter cutoff
            expect(params.filterCutoff).toBe(MOOD_MODIFIERS.calm.filterCutoff);
        });

        it('preserves instrument-specific params not in mood', () => {
            const params = getVoiceParams('erhu', 'calm');
            // Erhu-specific portamentoTime should still be present
            expect(params.portamentoTime).toBeDefined();
        });

        it('merges envelope correctly', () => {
            const params = getVoiceParams('erhu', 'heroic');
            // Should have heroic envelope values
            expect(params.envelope.attack).toBe(MOOD_MODIFIERS.heroic.envelope?.attack);
            expect(params.envelope.sustain).toBe(MOOD_MODIFIERS.heroic.envelope?.sustain);
        });

        it('returns complete envelope with all ADSR fields', () => {
            instruments.forEach(instrument => {
                moods.forEach(mood => {
                    const params = getVoiceParams(instrument, mood);
                    expect(params.envelope.attack).toBeDefined();
                    expect(params.envelope.decay).toBeDefined();
                    expect(params.envelope.sustain).toBeDefined();
                    expect(params.envelope.release).toBeDefined();
                });
            });
        });
    });

    describe('ROLE_VELOCITY', () => {
        it('has velocity values for all roles', () => {
            expect(ROLE_VELOCITY.melody).toBeDefined();
            expect(ROLE_VELOCITY.countermelody).toBeDefined();
            expect(ROLE_VELOCITY.accompaniment).toBeDefined();
            expect(ROLE_VELOCITY.bass).toBeDefined();
        });

        it('melody has highest velocity', () => {
            expect(ROLE_VELOCITY.melody).toBeGreaterThan(ROLE_VELOCITY.accompaniment);
        });

        it('all velocities are in valid range (0-1)', () => {
            Object.values(ROLE_VELOCITY).forEach(velocity => {
                expect(velocity).toBeGreaterThan(0);
                expect(velocity).toBeLessThanOrEqual(1);
            });
        });
    });

    describe('ROLE_OCTAVE_OFFSET', () => {
        it('has offsets for all roles', () => {
            expect(ROLE_OCTAVE_OFFSET.melody).toBeDefined();
            expect(ROLE_OCTAVE_OFFSET.countermelody).toBeDefined();
            expect(ROLE_OCTAVE_OFFSET.accompaniment).toBeDefined();
            expect(ROLE_OCTAVE_OFFSET.bass).toBeDefined();
        });

        it('bass has negative octave offset', () => {
            expect(ROLE_OCTAVE_OFFSET.bass).toBeLessThan(0);
        });

        it('melody and countermelody have no offset', () => {
            expect(ROLE_OCTAVE_OFFSET.melody).toBe(0);
            expect(ROLE_OCTAVE_OFFSET.countermelody).toBe(0);
        });
    });

    describe('getTempoScaledAttack', () => {
        it('returns base attack at reference tempo (100 BPM)', () => {
            const baseAttack = 0.1;
            const result = getTempoScaledAttack(baseAttack, 100);
            expect(result).toBe(baseAttack);
        });

        it('returns shorter attack at faster tempo', () => {
            const baseAttack = 0.1;
            const result = getTempoScaledAttack(baseAttack, 150);
            expect(result).toBeLessThan(baseAttack);
        });

        it('returns longer attack at slower tempo', () => {
            const baseAttack = 0.1;
            const result = getTempoScaledAttack(baseAttack, 60);
            expect(result).toBeGreaterThan(baseAttack);
        });

        it('caps maximum attack at 1.5x base', () => {
            const baseAttack = 0.1;
            const result = getTempoScaledAttack(baseAttack, 40);
            expect(result).toBeLessThanOrEqual(baseAttack * 1.5);
        });
    });

    describe('rhythmToDuration', () => {
        it('calculates quarter note duration at 60 BPM', () => {
            // 60 BPM = 1 beat per second
            expect(rhythmToDuration(1.0, 60)).toBe(1.0);
        });

        it('calculates half note duration', () => {
            expect(rhythmToDuration(2.0, 60)).toBe(2.0);
        });

        it('calculates eighth note duration', () => {
            expect(rhythmToDuration(0.5, 60)).toBe(0.5);
        });

        it('scales correctly with tempo', () => {
            // At 120 BPM, quarter note = 0.5 seconds
            expect(rhythmToDuration(1.0, 120)).toBe(0.5);
        });

        it('handles slow tempos', () => {
            // At 40 BPM, quarter note = 1.5 seconds
            expect(rhythmToDuration(1.0, 40)).toBe(1.5);
        });
    });

    describe('INSTRUMENT_PAN', () => {
        const instruments: Instrument[] = ['erhu', 'guzheng', 'pipa', 'dizi'];

        it('has pan values for all instruments', () => {
            instruments.forEach(instrument => {
                expect(INSTRUMENT_PAN[instrument]).toBeDefined();
            });
        });

        it('all pan values are in valid range (-1 to 1)', () => {
            instruments.forEach(instrument => {
                const pan = INSTRUMENT_PAN[instrument];
                expect(pan).toBeGreaterThanOrEqual(-1);
                expect(pan).toBeLessThanOrEqual(1);
            });
        });

        it('instruments are spread across stereo field', () => {
            // Some should be left, some should be right
            const hasLeft = Object.values(INSTRUMENT_PAN).some(p => p < 0);
            const hasRight = Object.values(INSTRUMENT_PAN).some(p => p > 0);
            expect(hasLeft).toBe(true);
            expect(hasRight).toBe(true);
        });
    });

    describe('INSTRUMENT_GAIN', () => {
        const instruments: Instrument[] = ['erhu', 'guzheng', 'pipa', 'dizi'];

        it('has gain values for all instruments', () => {
            instruments.forEach(instrument => {
                expect(INSTRUMENT_GAIN[instrument]).toBeDefined();
            });
        });

        it('all gain values are in reasonable range (0-1)', () => {
            instruments.forEach(instrument => {
                const gain = INSTRUMENT_GAIN[instrument];
                expect(gain).toBeGreaterThan(0);
                expect(gain).toBeLessThanOrEqual(1);
            });
        });
    });
});
