import { offsetPeriod } from './portal-layers.js';

// Longer gaps (background tab, debugger) are clamped so the portal never visibly jumps.
export const MAX_FRAME_DELTA_SECONDS = 0.1;

export function wrap(value, period) {
  return ((value % period) + period) % period;
}

export function clampFrameDelta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  return Math.min(seconds, MAX_FRAME_DELTA_SECONDS);
}

export function createMotionState(layers) {
  return {
    drift: layers.map(() => 0),
  };
}

export function advanceMotion(state, layers, deltaSeconds) {
  const delta = clampFrameDelta(deltaSeconds);
  return {
    drift: layers.map((layer, index) =>
      wrap(state.drift[index] + layer.speed * delta, offsetPeriod(layer)),
    ),
  };
}
