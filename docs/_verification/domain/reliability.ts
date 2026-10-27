// packages/domain/src/reliability.ts — pure. Phase 2. See docs/05 §6.

export interface ReliabilityInput {
  attended: number;    // in the rolling window
  noShows: number;     // unexcused
  lateCancels: number; // left < 4 h before start, unexcused
}

export type ReliabilityTier = 'NEW' | 'RELIABLE' | 'STANDARD' | 'AT_RISK';

export const RELIABILITY_WINDOW = 20; // most recent counted outcomes
export const MIN_SAMPLE_FOR_SCORE = 5;

/**
 * Smoothed attendance ratio with a mild prior (+2 attended). Properties:
 *  - bounded 0..100, no cap/floor hacks;
 *  - a no-show costs 3x a late cancel, but both age out of the window;
 *  - new players are never shown as "bad" (tier NEW until enough data).
 */
export function reliabilityScore(i: ReliabilityInput): { score: number; sampleSize: number; tier: ReliabilityTier } {
  const sampleSize = i.attended + i.noShows + i.lateCancels;
  const score = Math.round((100 * (i.attended + 2)) / (i.attended + 3 * i.noShows + i.lateCancels + 2));
  const tier: ReliabilityTier =
    sampleSize < MIN_SAMPLE_FOR_SCORE ? 'NEW' : score >= 90 ? 'RELIABLE' : score >= 75 ? 'STANDARD' : 'AT_RISK';
  return { score, sampleSize, tier };
}

/** Take the newest outcomes up to the window; excused outcomes must be filtered out BEFORE calling this. */
export function windowOutcomes(outcomes: Array<'ATTENDED' | 'NO_SHOW' | 'LATE_CANCEL'>): ReliabilityInput {
  const recent = outcomes.slice(0, RELIABILITY_WINDOW); // caller passes newest-first
  return {
    attended: recent.filter((o) => o === 'ATTENDED').length,
    noShows: recent.filter((o) => o === 'NO_SHOW').length,
    lateCancels: recent.filter((o) => o === 'LATE_CANCEL').length,
  };
}
