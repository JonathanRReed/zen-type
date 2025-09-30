import React from 'react';
import type { DraftPrefs } from '../../lib/draftStore';

interface ToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  prefs: DraftPrefs;
  onPrefsChange: (prefs: Partial<DraftPrefs>) => void;
}

const SHORTCUTS = {
  tools: 'T',
  quickJump: '⌘K',
  search: '⌘F',
  outline: '⌘1',
  scratchpad: '⌘2',
  save: '⌘S',
};

export const ToolsPanel: React.FC<ToolsPanelProps> = ({
  isOpen,
  onClose,
  prefs,
  onPrefsChange,
}) => {
  if (!isOpen) return null;

  const togglePref = (key: keyof DraftPrefs) => {
    onPrefsChange({ [key]: !prefs[key] });
  };

  const applyPreset = (preset: DraftPrefs['preset']) => {
    const presets: Record<DraftPrefs['preset'], Partial<DraftPrefs>> = {
      minimal: {
        preset,
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
        preset,
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
        preset,
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

    onPrefsChange(presets[preset]);
  };

  return (
    <div
      className="fixed top-0 right-0 h-full w-80 bg-surface/95 backdrop-blur-sm border-l border-muted/20 shadow-xl z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Tools panel"
    >
      <div className="p-4 border-b border-muted/20 flex items-center justify-between sticky top-0 bg-surface/95 backdrop-blur-sm z-10">
        <h2 className="text-lg font-semibold text-foam">Tools</h2>
        <button
          onClick={onClose}
          className="text-muted hover:text-text transition-colors"
          aria-label="Close tools panel"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Presets */}
        <section>
          <h3 className="text-sm font-semibold text-text/80 mb-3">Presets</h3>
          <div className="space-y-2">
            {(['minimal', 'structural', 'editor-pro'] as const).map(preset => (
              <button
                key={preset}
                onClick={() => applyPreset(preset)}
                className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  prefs.preset === preset
                    ? 'bg-iris/20 border border-iris/40 text-iris'
                    : 'bg-overlay/40 border border-transparent hover:bg-overlay/60 text-text/80'
                }`}
              >
                {preset === 'minimal' && 'Minimal'}
                {preset === 'structural' && 'Structural'}
                {preset === 'editor-pro' && 'Editor Pro'}
              </button>
            ))}
          </div>
        </section>

        {/* Core Features */}
        <section>
          <h3 className="text-sm font-semibold text-text/80 mb-3">Core</h3>
          <div className="space-y-2">
            <ToggleItem
              label="Word & Character Counters"
              checked={prefs.counters}
              onChange={() => togglePref('counters')}
            />
            <ToggleItem
              label="Estimated Read Time"
              checked={prefs.readTime}
              onChange={() => togglePref('readTime')}
            />
          </div>
        </section>

        {/* Navigation */}
        <section>
          <h3 className="text-sm font-semibold text-text/80 mb-3">Navigation</h3>
          <div className="space-y-2">
            <ToggleItem
              label="Outline Panel"
              shortcut={SHORTCUTS.outline}
              checked={prefs.outline}
              onChange={() => togglePref('outline')}
            />
            <ToggleItem
              label="Quick Jump Palette"
              shortcut={SHORTCUTS.quickJump}
              checked={prefs.quickJump}
              onChange={() => togglePref('quickJump')}
            />
            <ToggleItem
              label="Search in Draft"
              shortcut={SHORTCUTS.search}
              checked={prefs.search}
              onChange={() => togglePref('search')}
            />
          </div>
        </section>

        {/* Text Insights */}
        <section>
          <h3 className="text-sm font-semibold text-text/80 mb-3">Text Insights</h3>
          <div className="space-y-2">
            <ToggleItem
              label="Keyword Highlighter"
              checked={prefs.keywordHighlighter}
              onChange={() => togglePref('keywordHighlighter')}
            />
            <ToggleItem
              label="Grammar & Clarity Checker"
              checked={prefs.grammar}
              onChange={() => togglePref('grammar')}
            />
          </div>
        </section>

        {/* Organization */}
        <section>
          <h3 className="text-sm font-semibold text-text/80 mb-3">Organization</h3>
          <div className="space-y-2">
            <ToggleItem
              label="Tags"
              checked={prefs.tags}
              onChange={() => togglePref('tags')}
            />
            <ToggleItem
              label="Scratchpad"
              shortcut={SHORTCUTS.scratchpad}
              checked={prefs.scratchpad}
              onChange={() => togglePref('scratchpad')}
            />
          </div>
        </section>

        {/* Keyboard Shortcuts */}
        <section className="pt-4 border-t border-muted/20">
          <h3 className="text-sm font-semibold text-text/80 mb-3">Keyboard Shortcuts</h3>
          <div className="space-y-2 text-xs text-muted">
            <div className="flex justify-between">
              <span>Toggle Tools</span>
              <kbd className="px-2 py-1 bg-overlay/40 rounded">{SHORTCUTS.tools}</kbd>
            </div>
            <div className="flex justify-between">
              <span>Quick Jump</span>
              <kbd className="px-2 py-1 bg-overlay/40 rounded">{SHORTCUTS.quickJump}</kbd>
            </div>
            <div className="flex justify-between">
              <span>Search</span>
              <kbd className="px-2 py-1 bg-overlay/40 rounded">{SHORTCUTS.search}</kbd>
            </div>
            <div className="flex justify-between">
              <span>Save Snapshot</span>
              <kbd className="px-2 py-1 bg-overlay/40 rounded">{SHORTCUTS.save}</kbd>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

interface ToggleItemProps {
  label: string;
  shortcut?: string;
  checked: boolean;
  onChange: () => void;
}

const ToggleItem: React.FC<ToggleItemProps> = ({ label, shortcut, checked, onChange }) => (
  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-overlay/30 cursor-pointer group">
    <div className="flex items-center gap-2 flex-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 rounded border-muted/40 bg-overlay/40 text-iris focus:ring-iris/40 focus:ring-offset-0 cursor-pointer"
      />
      <span className="text-sm text-text/90">{label}</span>
    </div>
    {shortcut && (
      <kbd className="text-xs text-muted/60 px-2 py-0.5 bg-overlay/30 rounded">{shortcut}</kbd>
    )}
  </label>
);

export default ToolsPanel;
