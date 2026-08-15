/**
 * Pure ceiling math shared by every place that gates on `GET /v1/plan`.
 *
 * Kept out of the components so the `>=` and the `null`-is-unlimited rule are
 * defined once and tested directly, rather than duplicated (and potentially
 * drifting) across the code dialog, the invite form and the usage meter.
 */

/**
 * Whether a usage ceiling has been reached.
 *
 * `>=` not `>`: at 10 of 10 the next one is the eleventh. `null` means
 * unlimited, so it can never be reached — and a plan downgrade that leaves a
 * tenant over the ceiling (`used > limit`) is caught by the same comparison,
 * not treated as a separate case.
 */
export function isLimitReached(used: number, limit: number | null): boolean {
  return limit !== null && used >= limit;
}

/** Fill state for a usage meter's bar. */
export interface MeterFill {
  /** `false` for an unlimited ceiling: there is no track to draw. */
  show: boolean;
  /** Clamped to 100 — `used > limit` must not overflow the track. */
  percent: number;
  /** Same `>=` rule as `isLimitReached`, for colouring the bar. */
  over: boolean;
}

export function meterFill(used: number, limit: number | null): MeterFill {
  if (limit === null) return { show: false, percent: 0, over: false };
  return {
    show: true,
    percent: Math.min(100, Math.round((used / limit) * 100)),
    over: used >= limit,
  };
}
