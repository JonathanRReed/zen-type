// While someone is typing, the header and footer step back so the passage is
// the only thing asking for attention. They return the moment the pointer
// moves, a control takes focus, or the keys go quiet.

const IDLE_MS = 2600;
const MOVE_THRESHOLD_PX = 6;

let timer: number | null = null;
let bound = false;
let lastX = 0;
let lastY = 0;

export function clearTyping(): void {
  if (typeof document === 'undefined') return;
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  document.documentElement.removeAttribute('data-typing');
}

function onPointerMove(e: PointerEvent): void {
  // A hand resting near a trackpad jitters by a pixel or two; that is not
  // someone reaching for the menu.
  if (Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY) < MOVE_THRESHOLD_PX) return;
  lastX = e.clientX;
  lastY = e.clientY;
  clearTyping();
}

export function markTyping(): void {
  if (typeof document === 'undefined') return;
  if (!bound) {
    bound = true;
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', clearTyping, { passive: true });
  }
  document.documentElement.setAttribute('data-typing', 'on');
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(clearTyping, IDLE_MS);
}
