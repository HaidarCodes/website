import { PATTERN_SIZE, createRandom } from './portal-layers.js';

export const PATTERN_SEED = 0x656e64;
export const DEFAULT_STREAK_COUNT = 900;
export const MAX_STREAK_LENGTH = 4;

// Relative weights for streak lengths 1..MAX_STREAK_LENGTH texels; most streaks are short.
const LENGTH_WEIGHTS = [3, 4, 2, 1];
const TAIL_FALLOFF = 0.45;

const sumOf = (values) => values.reduce((total, value) => total + value, 0);

function pickLength(random) {
  let roll = random() * sumOf(LENGTH_WEIGHTS);
  for (let index = 0; index < LENGTH_WEIGHTS.length; index += 1) {
    roll -= LENGTH_WEIGHTS[index];
    if (roll < 0) {
      return index + 1;
    }
  }
  return LENGTH_WEIGHTS.length;
}

/**
 * Generates the tileable RGBA8 texture every portal layer samples (own procedural design).
 * R: brightness of short vertical streaks on black, with a bright core and fading tails.
 * G: per-streak rank in 1..255; a layer only shows streaks whose rank is within its density.
 * B: fine background grain for the dark base colour.
 * Streaks never touch each other, so a layer always reads as separate particles.
 */
export function createPattern({
  size = PATTERN_SIZE,
  streaks = DEFAULT_STREAK_COUNT,
  seed = PATTERN_SEED,
} = {}) {
  if (!Number.isInteger(size) || size < 8 || (size & (size - 1)) !== 0) {
    throw new RangeError('Pattern size must be a power of two of at least 8.');
  }
  if (!Number.isInteger(streaks) || streaks < 0) {
    throw new RangeError('Streak count must be a non-negative integer.');
  }

  const random = createRandom(seed);
  const data = new Uint8Array(size * size * 4);
  const occupied = new Uint8Array(size * size);
  const mask = size - 1;
  const cell = (x, y) => (y & mask) * size + (x & mask);

  const isFree = (x, y, length) => {
    for (let dy = -1; dy <= length; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (occupied[cell(x + dx, y + dy)]) {
          return false;
        }
      }
    }
    return true;
  };

  let placed = 0;
  for (let attempt = 0; attempt < streaks * 8 && placed < streaks; attempt += 1) {
    const x = Math.floor(random() * size);
    const y = Math.floor(random() * size);
    const length = pickLength(random);
    if (!isFree(x, y, length)) {
      continue;
    }

    // Skewed towards dim streaks so only a few particles stand out per layer.
    const peak = 0.12 + 0.88 * random() ** 2;
    const core = Math.floor(random() * length);
    const rank = 1 + Math.floor(random() * 255);
    for (let step = 0; step < length; step += 1) {
      const index = cell(x, y + step);
      occupied[index] = 1;
      data[index * 4] = Math.max(1, Math.round(255 * peak * TAIL_FALLOFF ** Math.abs(step - core)));
      data[index * 4 + 1] = rank;
    }
    placed += 1;
  }

  for (let index = 0; index < size * size; index += 1) {
    data[index * 4 + 2] = Math.floor(random() * 256);
    data[index * 4 + 3] = 255;
  }

  return { size, data, streakCount: placed };
}
