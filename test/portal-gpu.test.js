import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SLOT_PERIOD, SLOT_SHIFT, SLOT_TEXELS, createLayers, offsetPeriod } from '../public/js/portal-layers.js';
import { createFragmentShader } from '../public/js/portal-renderer.js';
import { packLayerColor, packLayerOffsets, packLayerShape } from '../public/js/portal-uniforms.js';

const close = (actual, expected, epsilon = 1e-3) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);

describe('packLayerShape', () => {
  it('packs rotation, texel size and density per layer', () => {
    const layers = createLayers({ count: 3 });
    const data = packLayerShape(layers);
    assert.equal(data.length, 12);
    layers.forEach((layer, index) => {
      const [cos, sin, texelSize, density] = data.subarray(index * 4, index * 4 + 4);
      close(cos, Math.cos(layer.angle), 1e-6);
      close(sin, Math.sin(layer.angle), 1e-6);
      close(texelSize, layer.texelSize, 1e-6);
      close(density, layer.density, 1e-6);
    });
  });
});

describe('packLayerColor', () => {
  it('packs RGB per layer', () => {
    const layers = createLayers({ count: 2 });
    const data = packLayerColor(layers);
    assert.equal(data.length, 6);
    layers.forEach((layer, index) => {
      layer.color.forEach((channel, offset) => close(data[index * 3 + offset], channel, 1e-6));
    });
  });
});

describe('packLayerOffsets', () => {
  const layer = { angle: 0, texelSize: 2, parallax: 0.5 };
  const period = offsetPeriod(layer);

  it('uses the drift as offset along the layer axis when the camera is at rest', () => {
    const target = new Float32Array(2);
    const result = packLayerOffsets([layer], [12], { x: 0, y: 0 }, target);
    assert.equal(result, target);
    close(target[0], 0);
    close(target[1], 12);
  });

  it('shifts each layer by its parallax share of the camera, flipping y for the shader', () => {
    const [offsetX, offsetY] = packLayerOffsets([layer], [0], { x: 40, y: 10 });
    close(offsetX, period - 20);
    close(offsetY, 5);
  });

  it('rotates the camera shift into the layer space', () => {
    const rotated = { ...layer, angle: Math.PI / 2, parallax: 1 };
    const [offsetX, offsetY] = packLayerOffsets([rotated], [0], { x: 10, y: 0 });
    close(offsetX, 0);
    close(offsetY, period - 10);
  });

  it('keeps offsets within one pattern period for float precision', () => {
    const layers = createLayers({ count: 5 });
    const data = packLayerOffsets(layers, layers.map(() => 1e9), { x: -1e8, y: 3e7 });
    layers.forEach((entry, index) => {
      for (const value of data.subarray(index * 2, index * 2 + 2)) {
        assert.ok(value >= 0 && value < offsetPeriod(entry), `offset ${value} not wrapped`);
      }
    });
  });

  it('rejects mismatched buffers', () => {
    const layers = createLayers({ count: 2 });
    assert.throws(() => packLayerOffsets(layers, [1], { x: 0, y: 0 }), RangeError);
    assert.throws(
      () => packLayerOffsets(layers, [1, 2], { x: 0, y: 0 }, new Float32Array(2)),
      RangeError,
    );
  });
});

describe('createFragmentShader', () => {
  it('declares the requested layer count', () => {
    assert.match(createFragmentShader(7), /#define LAYER_COUNT 7\n/);
  });

  it('uses the same slot geometry and period as the JavaScript offset wrapping', () => {
    const shader = createFragmentShader(1);
    assert.equal(1 << SLOT_SHIFT, SLOT_TEXELS);
    assert.match(shader, new RegExp(`const int SLOT_SHIFT = ${SLOT_SHIFT};`));
    assert.match(shader, new RegExp(`const int SLOT_TEXELS = ${SLOT_TEXELS};`));
    assert.match(shader, new RegExp(`const int PERIOD_MASK = ${SLOT_PERIOD - 1};`));
  });
});
