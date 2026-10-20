import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { allowsDrag, shouldAnimate } from '../public/js/motion-preference.js';
import {
  MAX_PIXEL_RATIO,
  MAX_RENDER_PIXELS,
  computeRenderSize,
} from '../public/js/render-size.js';

describe('computeRenderSize', () => {
  it('uses the CSS size on standard displays', () => {
    assert.deepEqual(computeRenderSize(800, 600, 1), { width: 800, height: 600, scale: 1 });
  });

  it('caps the device pixel ratio', () => {
    const size = computeRenderSize(400, 300, 3);
    assert.equal(size.scale, MAX_PIXEL_RATIO);
    assert.equal(size.width, 400 * MAX_PIXEL_RATIO);
  });

  it('respects the total pixel budget on very large screens', () => {
    const size = computeRenderSize(3840, 2160, 2);
    assert.ok(size.width * size.height <= MAX_RENDER_PIXELS);
    assert.ok(Math.abs(size.width / size.height - 3840 / 2160) < 0.01);
  });

  it('falls back to a 1x1 canvas for hidden or invalid sizes', () => {
    for (const [width, height, ratio] of [
      [0, 0, 1],
      [Number.NaN, 100, 1],
      [100, -5, 1],
    ]) {
      const size = computeRenderSize(width, height, ratio);
      assert.ok(size.width >= 1 && size.height >= 1);
      assert.ok(Number.isFinite(size.scale) && size.scale > 0);
    }
    assert.equal(computeRenderSize(10, 10, 0).scale, 1);
  });
});

describe('shouldAnimate', () => {
  it('animates by default', () => {
    assert.equal(shouldAnimate(), true);
  });

  it('respects prefers-reduced-motion', () => {
    assert.equal(shouldAnimate({ prefersReducedMotion: true }), false);
  });

  it('lets an explicit user choice win', () => {
    assert.equal(shouldAnimate({ userChoice: 'play', prefersReducedMotion: true }), true);
    assert.equal(shouldAnimate({ userChoice: 'pause', prefersReducedMotion: false }), false);
  });
});

describe('allowsDrag', () => {
  it('allows dragging by default and while the drift is paused', () => {
    assert.equal(allowsDrag(), true);
    assert.equal(allowsDrag({ userChoice: 'pause', prefersReducedMotion: false }), true);
  });

  it('disables drag parallax under reduced motion unless the user opts in', () => {
    assert.equal(allowsDrag({ prefersReducedMotion: true }), false);
    assert.equal(allowsDrag({ userChoice: 'pause', prefersReducedMotion: true }), false);
    assert.equal(allowsDrag({ userChoice: 'play', prefersReducedMotion: true }), true);
  });
});
