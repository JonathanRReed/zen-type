import { useEffect, type FC } from 'react';
import { getSettings, updateSettings } from '../utils/storage';
import { armAudio } from '../utils/audioBridge';

// The Ctrl/Cmd shortcuts documented in the help sheet: Notes & Drafts, mute,
// and the progress view. A tiny client:only island so they fire even while a
// typing surface holds focus. Ctrl combos never produce characters, so there
// is no conflict with typing. Also the one place that arms the audio engine.
const GlobalShortcuts: FC = () => {
  useEffect(() => {
    armAudio();
    // This island renders last on each page, so its mount is a fair "the app
    // is listening" signal for tooling and tests.
    document.documentElement.setAttribute('data-app-ready', '1');
    const onKeyDown = (e: KeyboardEvent) => {
      if ((!e.ctrlKey && !e.metaKey) || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key !== 'd' && key !== 'm' && key !== 'p') return;
      // Claim the combo (notably Ctrl/Cmd+D bookmark) for the app action.
      e.preventDefault();
      e.stopPropagation();

      if (key === 'd') {
        window.dispatchEvent(new CustomEvent('toggleArchive'));
        return;
      }
      if (key === 'p') {
        window.dispatchEvent(new CustomEvent('toggleProgress'));
        return;
      }
      updateSettings({ soundEnabled: !getSettings().soundEnabled });
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      document.documentElement.removeAttribute('data-app-ready');
    };
  }, []);
  return null;
};

export default GlobalShortcuts;
