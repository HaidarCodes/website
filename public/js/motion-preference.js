/**
 * An explicit user choice (play/pause button) wins; otherwise the OS-level
 * reduced-motion preference decides whether the background animates.
 */
export function shouldAnimate({ userChoice = null, prefersReducedMotion = false } = {}) {
  if (userChoice === 'play') {
    return true;
  }
  if (userChoice === 'pause') {
    return false;
  }
  return !prefersReducedMotion;
}

/**
 * Drag parallax is user-driven, so pausing the drift keeps it available. Under an OS
 * reduced-motion preference it stays off unless the user explicitly turned animation on.
 */
export function allowsDrag({ userChoice = null, prefersReducedMotion = false } = {}) {
  return userChoice === 'play' || !prefersReducedMotion;
}
