import { navigate } from "astro:transitions/client";

// Page-level keys for the three app routes: Tab switches mode from the typing
// surface, Escape opens and closes the menu. Also tracks whether the reader
// has scrolled past the stage into the notes, so the fixed chrome can leave.
//
// Lives in a module, not inline in the layout, so both astro check and ESLint
// see fully typed TypeScript.

let isPaused = false;

function currentMode(): "quote" | "zen" {
  return document.querySelector("main[data-mode]")?.getAttribute("data-mode") === "zen" ? "zen" : "quote";
}

function handleKeys(e: KeyboardEvent): void {
  const active = document.activeElement;
  // Tab switches mode only from the typing surface itself, so it never
  // hijacks Tab anywhere else on the page. Shift+Tab is left alone so
  // keyboard users can always step back out to the header.
  const onTypingSurface = !!active?.hasAttribute?.("data-typing-surface");
  // The typing surface keeps focus while an overlay is open, so without this
  // guard Tab would navigate away from a paused session instead of moving
  // into the menu.
  const overlayOpen = !!document.querySelector('[role="dialog"], .overlay-backdrop');

  if (onTypingSurface && !overlayOpen && e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
    e.preventDefault();
    void navigate(currentMode() === "zen" ? "/quote/" : "/zen/");
    return;
  }

  if (e.key === "Escape") {
    e.preventDefault();
    isPaused = !isPaused;
    // The menu island may not have mounted yet; it reads this on mount.
    document.documentElement.dataset.paused = String(isPaused);
    window.dispatchEvent(new CustomEvent("togglePause", { detail: isPaused }));
  }
}

// Track the menu's real state. The header button and Resume both dispatch
// `togglePause` on their own, so without this `isPaused` drifts and the next
// Escape spends itself undoing the drift instead of opening the menu.
function syncPauseState(event: Event): void {
  const detail = (event as CustomEvent<boolean | undefined>).detail;
  isPaused = typeof detail === "boolean" ? detail : !isPaused;
  document.documentElement.dataset.paused = String(isPaused);
}

function trackScroll(): void {
  const below = window.scrollY > window.innerHeight * 0.18;
  if (below) document.documentElement.setAttribute("data-below", "on");
  else document.documentElement.removeAttribute("data-below");
}

/**
 * Attach the app shortcuts. Returns the teardown for the before-swap hook.
 */
export function registerAppShortcuts(): () => void {
  isPaused = false;
  delete document.documentElement.dataset.paused;
  document.addEventListener("keydown", handleKeys);
  window.addEventListener("togglePause", syncPauseState);
  window.addEventListener("scroll", trackScroll, { passive: true });
  trackScroll();
  return () => {
    document.removeEventListener("keydown", handleKeys);
    window.removeEventListener("togglePause", syncPauseState);
    window.removeEventListener("scroll", trackScroll);
    document.documentElement.removeAttribute("data-below");
  };
}
