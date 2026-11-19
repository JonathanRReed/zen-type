import React, { useEffect, useId, useRef } from 'react';
import type { DraftPrefs } from '../../lib/draftStore';
import { useModal } from '../../hooks/useModal';
import { IconClose } from '../icons';

interface ToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  prefs: DraftPrefs;
  onPrefsChange: (prefs: Partial<DraftPrefs>) => void;
}

const PRESETS: ReadonlyArray<{ id: DraftPrefs['preset']; label: string }> = [
  { id: 'minimal', label: 'Just the page' },
  { id: 'structural', label: 'Page and structure' },
  { id: 'editor-pro', label: 'Everything' },
];

const PRESET_PREFS: Record<DraftPrefs['preset'], Partial<DraftPrefs>> = {
  minimal: {
    counters: true,
    readTime: false,
    outline: false,
    quickJump: false,
    search: false,
    tags: false,
    scratchpad: false,
    keywordHighlighter: false,
    grammar: false,
  },
  structural: {
    counters: true,
    readTime: true,
    outline: true,
    quickJump: true,
    search: true,
    tags: false,
    scratchpad: false,
    keywordHighlighter: false,
    grammar: false,
  },
  'editor-pro': {
    counters: true,
    readTime: true,
    outline: true,
    quickJump: true,
    search: true,
    tags: true,
    scratchpad: true,
    keywordHighlighter: true,
    grammar: true,
  },
};

const ToolsPanel: React.FC<ToolsPanelProps> = ({
  isOpen,
  onClose,
  prefs,
  onPrefsChange,
}) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModal(backdropRef, onClose, isOpen);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const set = (key: keyof DraftPrefs) => (checked: boolean) => onPrefsChange({ [key]: checked });

  return (
    <div ref={backdropRef} className="overlay-backdrop" role="dialog" aria-modal="true" aria-labelledby="draft-tools-title">
      <div className="overlay-dismiss" aria-hidden="true" onClick={onClose} />
      <div className="overlay-card sheet sheet-md">
        <div className="sheet-head">
          <h2 id="draft-tools-title" className="sheet-title">Writing tools</h2>
          <button ref={closeRef} type="button" className="sheet-close" onClick={onClose} aria-label="Close writing tools">
            <IconClose />
          </button>
        </div>

        <section className="settings-group" aria-labelledby="draft-tools-presets">
          <h3 id="draft-tools-presets">How much to show</h3>
          <div className="chips preset-chips">
            {PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                className="chip"
                aria-pressed={prefs.preset === preset.id}
                onClick={() => onPrefsChange({ preset: preset.id, ...PRESET_PREFS[preset.id] })}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="setting-note" style={{ marginTop: '0.5rem' }}>A starting point. Each switch below still works on its own.</p>
        </section>

        <section className="settings-group">
          <h3>Counts</h3>
          <Toggle label="Words and characters" checked={prefs.counters} onChange={set('counters')} />
          <Toggle label="Reading time" checked={prefs.readTime} onChange={set('readTime')} />
        </section>

        <section className="settings-group">
          <h3>Getting around</h3>
          <Toggle label="Outline" keys={['Ctrl', '1']} checked={prefs.outline} onChange={set('outline')} />
          <Toggle label="Jump to a heading or line" keys={['Ctrl', 'K']} checked={prefs.quickJump} onChange={set('quickJump')} />
          <Toggle label="Find in draft" keys={['Ctrl', 'F']} checked={prefs.search} onChange={set('search')} />
        </section>

        <section className="settings-group">
          <h3>Checks</h3>
          <Toggle
            label="Repeated words"
            note="Lists the words you use most, under the page."
            checked={prefs.keywordHighlighter}
            onChange={set('keywordHighlighter')}
          />
          <Toggle
            label="Writing notes"
            note="Long sentences, doubled words, passive voice and stray spaces."
            checked={prefs.grammar}
            onChange={set('grammar')}
          />
        </section>

        <section className="settings-group">
          <h3>Organising</h3>
          <Toggle label="Tags" checked={prefs.tags} onChange={set('tags')} />
          <Toggle label="Scratchpad" keys={['Ctrl', '2']} checked={prefs.scratchpad} onChange={set('scratchpad')} />
        </section>

        <section className="settings-group">
          <h3>Keys</h3>
          <ul className="keys">
            <li><span>Open or close these tools</span><span className="keys-combo"><kbd>T</kbd></span></li>
            <li><span>Save a version now</span><span className="keys-combo"><kbd>Ctrl</kbd><kbd>S</kbd></span></li>
            <li><span>Close notes and drafts</span><span className="keys-combo"><kbd>Esc</kbd></span></li>
          </ul>
          <p className="setting-note" style={{ marginTop: '0.75rem' }}>On a Mac, use Cmd in place of Ctrl.</p>
        </section>
      </div>
    </div>
  );
};

interface ToggleProps {
  label: string;
  note?: string;
  keys?: string[];
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const Toggle: React.FC<ToggleProps> = ({ label, note, keys, checked, onChange }) => {
  const id = useId();
  return (
    <div className="setting">
      <label htmlFor={id} className="setting-label setting-label-row">
        {label}
        {keys && (
          <span className="keys-combo" aria-hidden="true">
            {keys.map(k => <kbd key={k}>{k}</kbd>)}
          </span>
        )}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {note && <p className="setting-note">{note}</p>}
    </div>
  );
};

export default ToolsPanel;
