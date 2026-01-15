/**
 * Voice module exports and factory.
 */

import type { Instrument } from '../../types/music';
import type { VoiceParameters, InstrumentVoice } from '../types';
import { ErhuVoice } from './ErhuVoice';
import { GuzhengVoice } from './GuzhengVoice';
import { PipaVoice } from './PipaVoice';
import { DiziVoice } from './DiziVoice';

export { BaseVoice } from './BaseVoice';
export { ErhuVoice } from './ErhuVoice';
export { GuzhengVoice } from './GuzhengVoice';
export { PipaVoice } from './PipaVoice';
export { DiziVoice } from './DiziVoice';

/**
 * Factory function to create an instrument voice.
 *
 * @param instrument - The instrument type
 * @param context - Audio context for synthesis
 * @param params - Voice parameters
 * @returns Configured instrument voice
 */
export function createVoice(
    instrument: Instrument,
    context: BaseAudioContext,
    params: VoiceParameters
): InstrumentVoice {
    switch (instrument) {
        case 'erhu':
            return new ErhuVoice(context, params);
        case 'guzheng':
            return new GuzhengVoice(context, params);
        case 'pipa':
            return new PipaVoice(context, params);
        case 'dizi':
            return new DiziVoice(context, params);
        default:
            // Fallback to erhu for unknown instruments
            console.warn(`[createVoice] Unknown instrument: ${instrument}, using erhu`);
            return new ErhuVoice(context, params);
    }
}

/**
 * Voice registry for dynamic instrument loading.
 */
export const VOICE_REGISTRY: Record<Instrument, new (context: BaseAudioContext, params: VoiceParameters) => InstrumentVoice> = {
    erhu: ErhuVoice,
    guzheng: GuzhengVoice,
    pipa: PipaVoice,
    dizi: DiziVoice,
};
