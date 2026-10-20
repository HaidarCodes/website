import { offsetPeriod } from './portal-layers.js';
import { wrap } from './portal-motion.js';

export function packLayerShape(layers) {
  const data = new Float32Array(layers.length * 4);
  layers.forEach((layer, index) => {
    data.set([Math.cos(layer.angle), Math.sin(layer.angle), layer.texelSize, layer.density], index * 4);
  });
  return data;
}

export function packLayerColor(layers) {
  const data = new Float32Array(layers.length * 3);
  layers.forEach((layer, index) => {
    data.set(layer.color, index * 3);
  });
  return data;
}

/**
 * Combines each layer's drift with its parallax share of the camera position into an offset in
 * the layer's rotated space. Offsets wrap at the layer's pattern period to keep float precision.
 */
export function packLayerOffsets(
  layers,
  drift,
  camera,
  target = new Float32Array(layers.length * 2),
) {
  if (drift.length !== layers.length || target.length !== layers.length * 2) {
    throw new RangeError('Drift and target buffer must match the layer count.');
  }
  layers.forEach((layer, index) => {
    const cos = Math.cos(layer.angle);
    const sin = Math.sin(layer.angle);
    // The camera uses screen orientation (y down); the shader's y axis points up.
    const shiftX = camera.x * layer.parallax;
    const shiftY = -camera.y * layer.parallax;
    const period = offsetPeriod(layer);
    target[index * 2] = wrap(-(cos * shiftX - sin * shiftY), period);
    target[index * 2 + 1] = wrap(drift[index] - (sin * shiftX + cos * shiftY), period);
  });
  return target;
}
