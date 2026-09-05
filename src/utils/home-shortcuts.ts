import { navigate } from "astro:transitions/client";

// Homepage keyboard shortcuts (Tab to Zen Mode, Escape for the pause menu).
//
// Lives in a module — not inline in index.astro — so both astro check and
// ESLint see fully typed TypeScript. The same handler written inline forced a
// choice between an implicit-any error under astro check and a parsing error
// under the ESLint Astro processor, which parses client scripts as JS.

let isPaused = false;

function handleKeys(e: KeyboardEvent): void {
  const ae = document.activeElement;
  // Tab switches mode only from the typing surface itself. The old
  // check was "not in any input", which never matched (the hidden
  // typing input always holds focus) so the documented shortcut
  // never fired, and it would have hijacked Tab everywhere else on
  // the page. Shift+Tab is deliberately left alone so keyboard
  // users can always step back out to the header.
  const onTypingSurface = !!(
    ae && ae.hasAttribute && ae.hasAttribute("data-typing-surface")
  );
  // The typing surface keeps focus while an overlay is open, so
  // without this guard Tab would navigate away from a paused
  // session instead of moving into the pause menu.
  const overlayOpen = !!document.querySelector(
    '[role="dialog"], .overlay-backdrop',
  );

  if (
    onTypingSurface &&
    !overlayOpen &&
    e.key === "Tab" &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.shiftKey
  ) {
    e.preventDefault();
    void navigate("/zen/");
  }

  if (e.key === "Escape") {
    e.preventDefault();
    isPaused = !isPaused;
    // The pause menu island may not have mounted yet; it reads this on mount.
    document.documentElement.dataset.paused = String(isPaused);
    window.dispatchEvent(
      new CustomEvent("togglePause", { detail: isPaused }),
    );
  }
}

// Track the menu's real state. The header button and the Resume
// button both dispatch `togglePause` on their own, so without this
// `isPaused` drifted and the next Escape spent itself undoing the
// drift instead of opening the menu. zen.astro already does this.
function syncPauseState(event: Event): void {
  const detail =
    typeof event === "object" && event !== null && "detail" in event
      ? (event as CustomEvent<boolean | undefined>).detail
      : undefined;
  isPaused = typeof detail === "boolean" ? detail : !isPaused;
  document.documentElement.dataset.paused = String(isPaused);
}

/**
 * Attach the homepage shortcuts. Safe to call again after a
 * ClientRouter swap: re-adding the same listener references is a no-op
 * per DOM deduplication, so after-swap re-registration cannot double up.
 * Returns an unregister function for the before-swap hook.
 */
export function registerHomeShortcuts(): () => void {
  document.addEventListener("keydown", handleKeys);
  window.addEventListener("togglePause", syncPauseState);
  return () => {
    document.removeEventListener("keydown", handleKeys);
    window.removeEventListener("togglePause", syncPauseState);
  };
}
