export const DEFAULT_LAYER_COUNT = 14;
export const DEFAULT_SEED = 0x6e6f75;

// Each layer is split into square slots of SLOT_TEXELS² texels holding at most one star.
export const SLOT_SHIFT = 4;
export const SLOT_TEXELS = 1 << SLOT_SHIFT;

// The star pattern repeats after this many slots per axis, which lets layer offsets wrap seamlessly.
export const SLOT_PERIOD = 2048;

const FULL_TURN = Math.PI * 2;

const lerp = (from, to, amount) => from + (to - from) * amount;

// Deterministic PRNG (mulberry32 algorithm) so every visit renders the same composition.
export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function hslToRgb(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = (((hue % 360) + 360) % 360) / 60;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const match = lightness - chroma / 2;
  const [red, green, blue] = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ][Math.floor(sector) % 6];
  return [red + match, green + match, blue + match];
}

export function offsetPeriod(layer) {
  return layer.texelSize * SLOT_TEXELS * SLOT_PERIOD;
}

/**
 * Builds the parallax layers of the portal background, ordered from far (index 0) to near.
 * Far layers are small, dim and violet; near layers are larger, brighter and teal.
 * Sizes and speeds are in CSS pixels, angles in radians, density is the chance that a slot
 * holds a star, parallax is how strongly a layer follows the dragged camera, colours are 0..1 RGB.
 */
export function createLayers({ count = DEFAULT_LAYER_COUNT, seed = DEFAULT_SEED } = {}) {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError('Layer count must be a positive integer.');
  }

  const random = createRandom(seed);

  return Array.from({ length: count }, (_, index) => {
    const depth = count === 1 ? 1 : index / (count - 1);
    const hue = lerp(255, 178, depth) + lerp(-14, 14, random());
    const saturation = lerp(0.4, 0.65, random());
    // Far layers are so dim and fine that they read as grain rather than as separate stars.
    const intensity = lerp(0.09, 0.8, depth ** 2);

    return {
      angle: random() * FULL_TURN,
      texelSize: lerp(2, 3.5, depth ** 1.2),
      density: lerp(0.075, 0.012, depth ** 0.6),
      speed: lerp(2, 7, depth) * lerp(0.8, 1.2, random()),
      parallax: lerp(0.12, 1, depth),
      color: hslToRgb(hue, saturation, 0.5).map((channel) => channel * intensity),
    };
  });
}
