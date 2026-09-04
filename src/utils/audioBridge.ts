// Keeps the audio engine in step with settings and arms the first-gesture
// unlock. Import once per page (any island will do); it is idempotent.

import { audioEngine } from './audioEngine';
import { getSettings, subscribeSettings } from './storage';

let armed = false;

export function armAudio(): void {
  if (armed || typeof window === 'undefined') return;
  armed = true;

  audioEngine.applySettings(getSettings());
  subscribeSettings((settings) => audioEngine.applySettings(settings));
  // Islands that still broadcast the legacy event without going through
  // updateSettings() are covered too.
  window.addEventListener('settingsChanged', (e) => {
    const detail = (e as CustomEvent).detail;
    if (detail && typeof detail === 'object') audioEngine.applySettings(detail);
  });

  const unlock = () => {
    void audioEngine.unlock();
  };
  // Browsers only start audio inside a gesture. Keep listening: the first
  // gesture may land while the tab is still backgrounded and fail to resume.
  const stopIfReady = () => {
    unlock();
    if (audioEngine.ready) {
      window.removeEventListener('pointerdown', stopIfReady, true);
      window.removeEventListener('keydown', stopIfReady, true);
      window.removeEventListener('touchstart', stopIfReady, true);
    }
  };
  window.addEventListener('pointerdown', stopIfReady, { capture: true, passive: true });
  window.addEventListener('keydown', stopIfReady, { capture: true, passive: true });
  window.addEventListener('touchstart', stopIfReady, { capture: true, passive: true });
}
