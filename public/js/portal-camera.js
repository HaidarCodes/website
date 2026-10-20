import { clampFrameDelta } from './portal-motion.js';

// Dragging moves a virtual camera over the layers. All distances are CSS pixels in screen
// orientation (y points down); times are DOMHighResTimeStamp milliseconds.

// How quickly the rendered camera catches up with the dragged target (1/s).
export const FOLLOW_RATE = 14;
// How quickly the glide after releasing the pointer slows down (1/s).
export const GLIDE_DECAY = 3.5;
export const MAX_GLIDE_SPEED = 1800;
// Holding the pointer still for this long before releasing cancels the glide.
export const RELEASE_IDLE_MS = 80;
// Smoothing factor for the pointer velocity estimate (0..1, higher reacts faster).
export const VELOCITY_SMOOTHING = 0.35;
export const SETTLE_DISTANCE = 0.05;
export const SETTLE_SPEED = 2;

// Coalesced pointer events can arrive almost simultaneously; this floor avoids velocity spikes.
const MIN_SAMPLE_MS = 4;

export function createCamera() {
  return {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    velocityX: 0,
    velocityY: 0,
    dragging: false,
    lastMoveTime: null,
  };
}

export function beginDrag(camera, timeMs) {
  return { ...camera, dragging: true, velocityX: 0, velocityY: 0, lastMoveTime: timeMs };
}

export function dragBy(camera, deltaX, deltaY, timeMs) {
  if (!camera.dragging) {
    return camera;
  }
  let { velocityX, velocityY } = camera;
  if (camera.lastMoveTime !== null && Number.isFinite(timeMs)) {
    const elapsedSeconds = Math.max(timeMs - camera.lastMoveTime, MIN_SAMPLE_MS) / 1000;
    velocityX += (deltaX / elapsedSeconds - velocityX) * VELOCITY_SMOOTHING;
    velocityY += (deltaY / elapsedSeconds - velocityY) * VELOCITY_SMOOTHING;
  }
  return {
    ...camera,
    targetX: camera.targetX + deltaX,
    targetY: camera.targetY + deltaY,
    velocityX,
    velocityY,
    lastMoveTime: timeMs,
  };
}

export function endDrag(camera, timeMs) {
  if (!camera.dragging) {
    return camera;
  }
  const idleMs = camera.lastMoveTime === null ? Infinity : timeMs - camera.lastMoveTime;
  const speed = Math.hypot(camera.velocityX, camera.velocityY);
  const glides = idleMs <= RELEASE_IDLE_MS && speed >= SETTLE_SPEED;
  const scale = glides ? Math.min(1, MAX_GLIDE_SPEED / speed) : 0;
  return {
    ...camera,
    dragging: false,
    velocityX: camera.velocityX * scale,
    velocityY: camera.velocityY * scale,
    lastMoveTime: null,
  };
}

export function advanceCamera(camera, deltaSeconds) {
  const delta = clampFrameDelta(deltaSeconds);
  let { targetX, targetY, velocityX, velocityY } = camera;

  if (!camera.dragging) {
    targetX += velocityX * delta;
    targetY += velocityY * delta;
    const decay = Math.exp(-GLIDE_DECAY * delta);
    velocityX *= decay;
    velocityY *= decay;
    if (Math.hypot(velocityX, velocityY) < SETTLE_SPEED) {
      velocityX = 0;
      velocityY = 0;
    }
  }

  const follow = 1 - Math.exp(-FOLLOW_RATE * delta);
  let x = camera.x + (targetX - camera.x) * follow;
  let y = camera.y + (targetY - camera.y) * follow;
  const resting = !camera.dragging && velocityX === 0 && velocityY === 0;
  if (resting && Math.hypot(targetX - x, targetY - y) < SETTLE_DISTANCE) {
    x = targetX;
    y = targetY;
  }

  return { ...camera, x, y, targetX, targetY, velocityX, velocityY };
}

export function isCameraSettled(camera) {
  return (
    !camera.dragging &&
    camera.velocityX === 0 &&
    camera.velocityY === 0 &&
    camera.x === camera.targetX &&
    camera.y === camera.targetY
  );
}
