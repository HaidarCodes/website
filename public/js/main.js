import { allowsDrag, shouldAnimate } from './motion-preference.js';
import { bindPortalDrag } from './portal-drag.js';
import { createPortalRenderer } from './portal-renderer.js';

const LABELS = {
  playing: 'Animation anhalten',
  paused: 'Animation abspielen',
};

const root = document.documentElement;
const canvas = document.querySelector('[data-portal-canvas]');
const toggle = document.querySelector('[data-motion-toggle]');
const toggleLabel = toggle?.querySelector('[data-motion-label]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let drag = null;

function disablePortal() {
  drag?.setEnabled(false);
  root.classList.remove('portal-active', 'portal-interactive', 'portal-dragging');
  if (toggle) {
    toggle.hidden = true;
  }
}

const renderer = canvas ? createPortalRenderer(canvas, { onFailure: disablePortal }) : null;

if (renderer) {
  let userChoice = null;

  drag = bindPortalDrag(canvas, renderer, {
    onDragChange: (dragging) => root.classList.toggle('portal-dragging', dragging),
  });

  const sync = () => {
    const preference = { userChoice, prefersReducedMotion: reducedMotion.matches };
    const animate = shouldAnimate(preference);
    const interactive = allowsDrag(preference);
    renderer.setAnimating(animate);
    drag.setEnabled(interactive);
    root.classList.toggle('portal-interactive', interactive);
    if (toggle && toggleLabel) {
      toggle.dataset.state = animate ? 'playing' : 'paused';
      toggleLabel.textContent = animate ? LABELS.playing : LABELS.paused;
    }
  };

  toggle?.addEventListener('click', () => {
    userChoice = toggle.dataset.state === 'playing' ? 'pause' : 'play';
    sync();
  });

  // A changed OS preference is a fresh signal and overrides an earlier button choice.
  reducedMotion.addEventListener('change', () => {
    userChoice = null;
    sync();
  });

  root.classList.add('portal-active');
  if (toggle) {
    toggle.hidden = false;
  }
  sync();
}
