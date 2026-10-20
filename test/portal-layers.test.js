import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_LAYER_COUNT,
  SLOT_PERIOD,
  SLOT_TEXELS,
  createLayers,
  createRandom,
  hslToRgb,
  offsetPeriod,
} from '../public/js/portal-layers.js';

describe('createRandom', () => {
  it('is deterministic for the same seed', () => {
    const first = createRandom(42);
    const second = createRandom(42);
    for (let i = 0; i < 20; i += 1) {
      assert.equal(first(), second());
    }
  });

  it('returns values in [0, 1)', () => {
    const random = createRandom(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = random();
      assert.ok(value >= 0 && value < 1, `out of range: ${value}`);
    }
  });
});

describe('hslToRgb', () => {
  const close = (actual, expected) =>
    actual.forEach((channel, index) => assert.ok(Math.abs(channel - expected[index]) < 1e-9));

  it('converts primary and secondary hues', () => {
    close(hslToRgb(0, 1, 0.5), [1, 0, 0]);
    close(hslToRgb(120, 1, 0.5), [0, 1, 0]);
    close(hslToRgb(180, 1, 0.5), [0, 1, 1]);
  });

  it('normalises hues outside 0..360', () => {
    close(hslToRgb(600, 1, 0.5), [0, 0, 1]);
    close(hslToRgb(-120, 1, 0.5), [0, 0, 1]);
  });
});

describe('createLayers', () => {
  const brightness = (layer) => Math.max(...layer.color);

  it('creates the default number of layers deterministically', () => {
    const layers = createLayers();
    assert.equal(layers.length, DEFAULT_LAYER_COUNT);
    assert.deepEqual(layers, createLayers());
    assert.notDeepEqual(layers, createLayers({ seed: 1 }));
  });

  it('rejects invalid layer counts', () => {
    for (const count of [0, -1, 1.5, Number.NaN]) {
      assert.throws(() => createLayers({ count }), RangeError);
    }
  });

  it('orders layers from far (fine, faint grain) to near (larger, brighter, sparser stars)', () => {
    const layers = createLayers();
    for (let i = 1; i < layers.length; i += 1) {
      assert.ok(layers[i].texelSize >= layers[i - 1].texelSize);
      assert.ok(layers[i].density <= layers[i - 1].density);
      assert.ok(layers[i].parallax > layers[i - 1].parallax);
    }
    assert.ok(brightness(layers.at(-1)) > 4 * brightness(layers[0]));
  });

  it('keeps the field sparse and every value in its expected range', () => {
    for (const layer of createLayers({ count: 32, seed: 99 })) {
      assert.ok(layer.angle >= 0 && layer.angle < Math.PI * 2);
      assert.ok(layer.texelSize >= 2 && layer.texelSize <= 3.5);
      assert.ok(layer.speed > 0 && layer.speed < 10);
      assert.ok(layer.density > 0 && layer.density <= 0.075);
      assert.ok(layer.parallax > 0 && layer.parallax <= 1);
      for (const channel of layer.color) {
        assert.ok(Number.isFinite(channel) && channel >= 0 && channel <= 0.8);
      }
    }
  });

  it('stays in the dark teal/blue/violet family of the reference look', () => {
    for (const layer of createLayers({ count: 32, seed: 1234 })) {
      const [red, , blue] = layer.color;
      assert.ok(blue > red, `unexpected colour ${layer.color}`);
    }
  });

  it('supports a single layer', () => {
    assert.equal(createLayers({ count: 1 }).length, 1);
  });
});

describe('slot geometry', () => {
  it('uses a power-of-two slot size and period so the shader can mask indices', () => {
    for (const value of [SLOT_TEXELS, SLOT_PERIOD]) {
      assert.ok(Number.isInteger(Math.log2(value)), `${value} is not a power of two`);
    }
  });

  it('wraps offsets after exactly one full slot period', () => {
    assert.equal(offsetPeriod({ texelSize: 2.5 }), 2.5 * SLOT_TEXELS * SLOT_PERIOD);
  });
});
