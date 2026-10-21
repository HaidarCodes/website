import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PATTERN_SIZE } from '../public/js/portal-layers.js';
import { MAX_STREAK_LENGTH, createPattern } from '../public/js/portal-pattern.js';

const pattern = createPattern();
const { size, data } = pattern;
const at = (x, y, channel) => data[(((y + size) % size) * size + ((x + size) % size)) * 4 + channel];
const lit = (x, y) => at(x, y, 0) > 0;

describe('createPattern', () => {
  it('builds a deterministic RGBA texture of the shared pattern size', () => {
    assert.equal(size, PATTERN_SIZE);
    assert.equal(data.length, size * size * 4);
    assert.deepEqual(createPattern().data, data);
    assert.notDeepEqual(createPattern({ seed: 1 }).data, data);
  });

  it('places nearly all requested streaks while keeping the texture mostly black', () => {
    assert.ok(pattern.streakCount > 800, `only ${pattern.streakCount} streaks placed`);
    let litTexels = 0;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        litTexels += lit(x, y) ? 1 : 0;
      }
    }
    assert.ok(litTexels / (size * size) < 0.05, `too many lit texels: ${litTexels}`);
  });

  it('draws separate vertical streaks of at most MAX_STREAK_LENGTH texels sharing one rank', () => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!lit(x, y) || lit(x, y - 1)) {
          continue;
        }
        let length = 0;
        while (lit(x, y + length)) {
          assert.equal(at(x, y + length, 1), at(x, y, 1), 'rank differs within a streak');
          assert.ok(!lit(x - 1, y + length) && !lit(x + 1, y + length), 'streaks touch sideways');
          length += 1;
        }
        assert.ok(length <= MAX_STREAK_LENGTH, `streak of ${length} texels at ${x},${y}`);
        assert.ok(at(x, y, 1) >= 1, 'lit texel without rank');
      }
    }
  });

  it('fills the grain channel and keeps alpha opaque', () => {
    const grain = new Set();
    for (let index = 0; index < size * size; index += 1) {
      grain.add(data[index * 4 + 2]);
      assert.equal(data[index * 4 + 3], 255);
    }
    assert.ok(grain.size > 200);
  });

  it('rejects invalid sizes and counts', () => {
    for (const options of [{ size: 100 }, { size: 4 }, { streaks: -1 }, { streaks: 1.5 }]) {
      assert.throws(() => createPattern(options), RangeError);
    }
  });
});
