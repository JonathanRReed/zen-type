import { useEffect, type FC } from 'react';
import { getSettings, saveSettings, type Settings } from '../utils/storage';
import { audioEngine } from '../utils/audioEngine';

// The documented Ctrl/Cmd shortcuts (see HelpSheetBody: Notes & Drafts,
// audio mute). Implemented here — and only here — as a tiny client:only
// island so they fire even while a typing surface holds focus. Ctrl combos
// never produce characters, so there is no conflict with typing; that is
// exactly why a focus-guarded global manager cannot serve this job.
const GlobalShortcuts: FC = () => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((!e.ctrlKey && !e.metaKey) || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key !== 'd' && key !== 'm') return;
      // Claim the combo (notably Ctrl/Cmd+D bookmark) for the app action.
      e.preventDefault();
      e.stopPropagation();

      if (key === 'd') {
        window.dispatchEvent(new CustomEvent('toggleArchive'));
        return;
      }

      // Mute toggle mirrors the header sound button's transition.
      try {
        const s = getSettings();
        const nextEnabled = !s.soundEnabled;
        const next: Settings = {
          ...s,
          soundEnabled: nextEnabled,
          switchSound:
            nextEnabled && (!s.switchSound || s.switchSound === 'none')
              ? 'thock'
              : (s.switchSound ?? 'none'),
        };
        audioEngine.setMuted(!nextEnabled);
        saveSettings(next);
        window.dispatchEvent(new CustomEvent('settingsChanged', { detail: next }));
      } catch {
        // Storage blocked: nothing to persist; the header keeps showing state.
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
  return null;
};

export default GlobalShortcuts;
