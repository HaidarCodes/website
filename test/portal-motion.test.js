import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createLayers, offsetPeriod } from '../public/js/portal-layers.js';
import {
  MAX_FRAME_DELTA_SECONDS,
  advanceMotion,
  clampFrameDelta,
  createMotionState,
  wrap,
} from '../public/js/portal-motion.js';

describe('wrap', () => {
  it('keeps values within [0, period)', () => {
    assert.equal(wrap(5, 4), 1);
    assert.equal(wrap(-1, 4), 3);
    assert.equal(wrap(4, 4), 0);
  });
});

describe('clampFrameDelta', () => {
  it('ignores invalid or negative deltas', () => {
    for (const value of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(clampFrameDelta(value), 0);
    }
  });

  it('caps long pauses such as background tabs', () => {
    assert.equal(clampFrameDelta(30), MAX_FRAME_DELTA_SECONDS);
    assert.equal(clampFrameDelta(0.02), 0.02);
  });
});

describe('advanceMotion', () => {
  const layers = createLayers({ count: 4 });

  it('drifts each layer by its own speed', () => {
    const state = advanceMotion(createMotionState(layers), layers, 0.05);
    state.drift.forEach((offset, index) => {
      assert.ok(Math.abs(offset - layers[index].speed * 0.05) < 1e-9);
    });
  });

  it('does not mutate the previous state', () => {
    const initial = createMotionState(layers);
    advanceMotion(initial, layers, 0.05);
    assert.deepEqual(initial, createMotionState(layers));
  });

  it('wraps drift at the seamless pattern period', () => {
    const nearEnd = { drift: layers.map((layer) => offsetPeriod(layer) - 0.01) };
    const state = advanceMotion(nearEnd, layers, 0.1);
    state.drift.forEach((offset, index) => {
      assert.ok(offset >= 0 && offset < 2, `drift ${index} did not wrap: ${offset}`);
    });
  });

  it('clamps large frame gaps instead of jumping', () => {
    const state = advanceMotion(createMotionState(layers), layers, 120);
    state.drift.forEach((offset, index) => {
      assert.ok(offset <= layers[index].speed * MAX_FRAME_DELTA_SECONDS + 1e-9);
    });
  });
});
