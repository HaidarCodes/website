import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FOLLOW_RATE,
  MAX_GLIDE_SPEED,
  RELEASE_IDLE_MS,
  advanceCamera,
  beginDrag,
  createCamera,
  dragBy,
  endDrag,
  isCameraSettled,
} from '../public/js/portal-camera.js';

const FRAME = 1 / 60;

function settle(camera, maxFrames = 600) {
  let current = camera;
  for (let frame = 0; frame < maxFrames && !isCameraSettled(current); frame += 1) {
    current = advanceCamera(current, FRAME);
  }
  return current;
}

function dragAcross(steps, stepX, stepY, stepMs = 16) {
  let camera = beginDrag(createCamera(), 0);
  for (let step = 1; step <= steps; step += 1) {
    camera = dragBy(camera, stepX, stepY, step * stepMs);
  }
  return camera;
}

describe('camera drag', () => {
  it('starts at rest', () => {
    assert.equal(isCameraSettled(createCamera()), true);
  });

  it('moves the target with the pointer and eases the camera towards it', () => {
    const dragged = dragAcross(5, 10, -4);
    assert.equal(dragged.targetX, 50);
    assert.equal(dragged.targetY, -20);
    assert.equal(dragged.x, 0);

    const eased = advanceCamera(dragged, FRAME);
    const expected = 50 * (1 - Math.exp(-FOLLOW_RATE * FRAME));
    assert.ok(Math.abs(eased.x - expected) < 1e-9);
    assert.ok(eased.x > 0 && eased.x < 50);
  });

  it('never settles while the pointer is held', () => {
    const held = advanceCamera(beginDrag(createCamera(), 0), FRAME);
    assert.equal(isCameraSettled(held), false);
  });

  it('ignores moves that are not part of a drag', () => {
    const camera = createCamera();
    assert.equal(dragBy(camera, 10, 10, 16), camera);
    assert.equal(endDrag(camera, 16), camera);
  });

  it('settles exactly on the target after a release without momentum', () => {
    const released = endDrag(dragAcross(5, 10, 0), 80 + RELEASE_IDLE_MS + 1);
    assert.equal(released.velocityX, 0);
    const rested = settle(released);
    assert.equal(isCameraSettled(rested), true);
    assert.equal(rested.x, 50);
    assert.equal(rested.y, 0);
  });

  it('glides on in the drag direction after a quick release, then comes to rest', () => {
    const released = endDrag(dragAcross(5, 10, 0), 80);
    assert.ok(released.velocityX > 0);
    const rested = settle(released);
    assert.equal(isCameraSettled(rested), true);
    assert.ok(rested.x > 50, `expected glide beyond the release point, got ${rested.x}`);
    assert.ok(rested.x < 50 + MAX_GLIDE_SPEED);
  });

  it('caps the glide speed for very fast flicks', () => {
    const released = endDrag(dragAcross(3, 500, 500, 4), 12);
    assert.ok(Math.hypot(released.velocityX, released.velocityY) <= MAX_GLIDE_SPEED + 1e-9);
  });

  it('does not mutate previous states', () => {
    const start = createCamera();
    const dragged = dragBy(beginDrag(start, 0), 10, 10, 16);
    advanceCamera(dragged, FRAME);
    endDrag(dragged, 20);
    assert.deepEqual(start, createCamera());
    assert.equal(dragged.targetX, 10);
    assert.equal(dragged.dragging, true);
  });
});
