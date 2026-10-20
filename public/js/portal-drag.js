/**
 * Turns primary-pointer drags on the target into camera movement. Uses pointer capture so a
 * drag keeps working when the pointer leaves the canvas, and ignores secondary touches.
 */
export function bindPortalDrag(target, camera, { onDragChange = () => {} } = {}) {
  const win = target.ownerDocument.defaultView;
  let enabled = false;
  let pointerId = null;
  let lastX = 0;
  let lastY = 0;

  function finish(timeMs) {
    pointerId = null;
    camera.endDrag(timeMs);
    onDragChange(false);
  }

  target.addEventListener('pointerdown', (event) => {
    if (!enabled || pointerId !== null || !event.isPrimary || event.button !== 0) {
      return;
    }
    event.preventDefault();
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    target.setPointerCapture(pointerId);
    camera.beginDrag(event.timeStamp);
    onDragChange(true);
  });

  target.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) {
      return;
    }
    const deltaX = event.clientX - lastX;
    const deltaY = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (deltaX !== 0 || deltaY !== 0) {
      camera.dragBy(deltaX, deltaY, event.timeStamp);
    }
  });

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    target.addEventListener(type, (event) => {
      if (event.pointerId === pointerId) {
        finish(event.timeStamp);
      }
    });
  }

  return {
    setEnabled(value) {
      enabled = Boolean(value);
      if (!enabled && pointerId !== null) {
        const id = pointerId;
        finish(win.performance.now());
        if (target.hasPointerCapture(id)) {
          target.releasePointerCapture(id);
        }
      }
    },
  };
}
