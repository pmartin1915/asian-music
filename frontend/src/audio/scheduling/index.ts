/**
 * Scheduling module exports.
 */

export { mapCompositionToTracks, getCompositionDuration, buildScale } from './CompositionMapper';
export {
    generateEuclidean,
    numericToBoolean,
    rotatePattern,
    patternToTimes,
    repeatPatternTimes,
    getPresetPattern,
    getPatternDensity,
    combinePatterns,
    invertPattern,
    RHYTHM_PRESETS,
} from './EuclideanRhythm';
export {
    scheduleTrack,
    scheduleAllTracks,
    createSimpleScheduler,
    getNotesDensity,
    getTrackTimeRange,
    filterNotesInRange,
    quantizeNotes,
    humanizeNotes,
    sortNotesByTime,
    mergeTracksNotes,
} from './NoteScheduler';
export type { SchedulingContext, NoteScheduleCallback } from './NoteScheduler';
