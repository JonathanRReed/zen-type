// The menu's markup and controls. Everything in this file is behind the
// dynamic import in PauseMenu.tsx, so none of it reaches the browser until
// the menu is primed or opened.
import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { getSettings, updateSettings, getStats, getStreak, type Settings } from '../utils/storage';
import { useModal } from '../hooks/useModal';

// Both panels are one click deep inside a menu that is closed at first paint,
// so they load on demand instead of shipping with the menu.
const SettingsPanel = lazy(() => import('./SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const AboutPanel = lazy(() => import('./AboutPanel').then(m => ({ default: m.AboutPanel })));

const PanelFallback = () => (
  <p className="sheet-meta" role="status" aria-live="polite">Loading…</p>
);

interface PauseMenuBodyProps {
  mode: 'zen' | 'quote';
  /**
   * Owned by the shell so the `togglePause` listener can stay eager. The body
   * keeps rendering (as null) while closed instead of unmounting, so
   * reopening the menu lands on whatever sub-view you left it on.
   */
  open: boolean;
  onClose: () => void;
}

type View = 'menu' | 'settings' | 'about';

const PauseMenuBody: React.FC<PauseMenuBodyProps> = ({ mode, open, onClose }) => {
  const [view, setView] = useState<View>('menu');
  const [settings, setSettings] = useState<Settings>(getSettings);
  const [stats, setStats] = useState(getStats);
  const [streak, setStreak] = useState(0);
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Re-read persisted state every time the menu opens.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(getSettings());
    setStats(getStats());
    setStreak(getStreak());
  }, [open]);

  useModal(backdropRef, onClose, open);

  // The typing surface holds focus for the whole session, so focus has to be
  // moved into the dialog for it to be announced and for Tab to start inside.
  useEffect(() => {
    if (open) cardRef.current?.focus();
  }, [open, view]);

  const applySettingsPatch = useCallback((patch: Partial<Settings>) => {
    setSettings(updateSettings(patch));
  }, []);

  if (!open) return null;

  // Close, then hand off to another overlay or to the typing surface.
  const leaveFor = (eventName: string, detail?: unknown) => {
    onClose();
    window.dispatchEvent(new CustomEvent(eventName, detail === undefined ? undefined : { detail }));
  };

  // The dialog's accessible name tracks the sub-view, so it never points at
  // a heading that has unmounted.
  const labelId = view === 'settings' ? 'pause-settings-title' : view === 'about' ? 'pause-about-title' : 'pause-title';

  return (
    <div ref={backdropRef} className="overlay-backdrop" role="dialog" aria-modal="true" aria-labelledby={labelId}>
      {/* Backdrop dismiss is a plain layer, not a tab stop. */}
      <div className="overlay-dismiss" aria-hidden="true" onClick={onClose} />
      <div ref={cardRef} className={`overlay-card sheet${view === 'settings' ? ' sheet-md' : ''}`} tabIndex={-1}>
        {view === 'menu' && (
          <>
            <div className="sheet-head">
              <h2 id="pause-title" className="sheet-title">Paused</h2>
            </div>

            <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
              Resume <kbd aria-hidden="true">Esc</kbd>
            </button>

            <ul className="menu-rows">
              <li>
                <button type="button" className="menu-row" onClick={() => setView('settings')}>Settings</button>
              </li>
              {mode === 'quote' && (
                <li>
                  <button type="button" className="menu-row" onClick={() => leaveFor('openCustomText')}>Type your own text</button>
                </li>
              )}
              <li>
                <button type="button" className="menu-row" onClick={() => leaveFor('toggleArchive', true)}>
                  Notes and drafts <kbd aria-hidden="true">Ctrl D</kbd>
                </button>
              </li>
              <li>
                <button type="button" className="menu-row" onClick={() => leaveFor('toggleProgress', true)}>
                  Progress <kbd aria-hidden="true">Ctrl P</kbd>
                </button>
              </li>
              <li>
                <button type="button" className="menu-row" onClick={() => leaveFor('toggleHelp', true)}>
                  Keyboard shortcuts <kbd aria-hidden="true">Ctrl H</kbd>
                </button>
              </li>
              <li>
                <button type="button" className="menu-row" onClick={() => setView('about')}>About</button>
              </li>
              <li>
                {/* The typing surface, not the menu, owns the session: the
                    canvas records what was typed and reloads, the quote page
                    draws a fresh quote. */}
                <button type="button" className="menu-row menu-row-danger" onClick={() => leaveFor('resetSession')}>
                  Reset session
                </button>
              </li>
            </ul>

            <div className="menu-toggles">
              <div className="setting">
                <label htmlFor="pause-reduced-motion" className="setting-label">Reduced motion</label>
                <input
                  id="pause-reduced-motion"
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={!!settings.reducedMotion}
                  onChange={(e) => applySettingsPatch({ reducedMotion: e.target.checked })}
                />
              </div>
              <div className="setting">
                <label htmlFor="pause-high-contrast" className="setting-label">High contrast</label>
                <input
                  id="pause-high-contrast"
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={!!settings.highContrast}
                  onChange={(e) => applySettingsPatch({ highContrast: e.target.checked })}
                />
              </div>
            </div>

            <dl className="menu-sofar" aria-label="So far">
              <div><dt>words so far</dt><dd>{stats.totalWords.toLocaleString()}</dd></div>
              <div><dt>best wpm</dt><dd>{stats.bestWpm}</dd></div>
              <div><dt>{streak === 1 ? 'day in a row' : 'days in a row'}</dt><dd>{streak}</dd></div>
            </dl>
          </>
        )}

        {view === 'settings' && (
          <Suspense fallback={<PanelFallback />}>
            <SettingsPanel
              settings={settings}
              mode={mode}
              onSettingChange={(key, value) => setSettings(prev => ({ ...prev, [key]: value }))}
              onClose={() => setView('menu')}
            />
          </Suspense>
        )}

        {view === 'about' && (
          <Suspense fallback={<PanelFallback />}>
            <AboutPanel onClose={() => setView('menu')} />
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default PauseMenuBody;
