// Command palette for quick actions
import React, { useEffect, useRef, useState } from 'react';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  category: 'document' | 'edit' | 'view' | 'navigation';
  action: string;
}

interface CommandPaletteProps {
  onCommand: (command: string, args?: any) => void;
  onClose: () => void;
}

const commands: Command[] = [
  // Document commands
  { id: 'new-doc', label: 'New Document', shortcut: '⌘N', category: 'document', action: 'newDocument' },
  { id: 'save', label: 'Save', shortcut: '⌘S', category: 'document', action: 'save' },
  { id: 'export-md', label: 'Export as Markdown', category: 'document', action: 'exportMarkdown' },
  { id: 'export-json', label: 'Export as JSON', category: 'document', action: 'exportJSON' },
  { id: 'print', label: 'Print', shortcut: '⌘P', category: 'document', action: 'print' },
  
  // Edit commands
  { id: 'undo', label: 'Undo', shortcut: '⌘Z', category: 'edit', action: 'undo' },
  { id: 'redo', label: 'Redo', shortcut: '⌘⇧Z', category: 'edit', action: 'redo' },
  { id: 'find', label: 'Find', shortcut: '⌘F', category: 'edit', action: 'find' },
  { id: 'replace', label: 'Replace', shortcut: '⌘⇧F', category: 'edit', action: 'replace' },
  { id: 'bold', label: 'Bold', shortcut: '⌘B', category: 'edit', action: 'toggleBold' },
  { id: 'italic', label: 'Italic', shortcut: '⌘I', category: 'edit', action: 'toggleItalic' },
  { id: 'code', label: 'Inline Code', shortcut: '⌘⇧C', category: 'edit', action: 'toggleCode' },
  
  // View commands
  { id: 'focus-mode', label: 'Toggle Focus Mode', category: 'view', action: 'toggleFocusMode' },
  { id: 'typewriter', label: 'Toggle Typewriter Mode', category: 'view', action: 'toggleTypewriter' },
  { id: 'fullscreen', label: 'Toggle Fullscreen', category: 'view', action: 'toggleFullscreen' },
  { id: 'theme', label: 'Change Theme', category: 'view', action: 'changeTheme' },
  
  // Navigation
  { id: 'library', label: 'Go to Library', shortcut: '⌘L', category: 'navigation', action: 'goToLibrary' },
  { id: 'search-docs', label: 'Search Documents', shortcut: '⌘K', category: 'navigation', action: 'searchDocuments' },
  { id: 'recent', label: 'Recent Documents', category: 'navigation', action: 'recentDocuments' },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ onCommand, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );
  
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(filteredCommands.length - 1, prev + 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            onCommand(filteredCommands[selectedIndex].action);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, filteredCommands, onCommand, onClose]);

  let currentIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-base/60 backdrop-blur-sm">
      <div className="glass rounded-xl border border-muted/20 shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="border-b border-muted/20 p-4">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search..."
            className="w-full bg-transparent outline-none text-text placeholder-muted"
          />
        </div>
        
        <div className="max-h-96 overflow-y-auto p-2">
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category} className="mb-2">
              <div className="px-2 py-1 text-xs font-medium text-muted uppercase tracking-wider">
                {category}
              </div>
              {cmds.map((cmd) => {
                const isSelected = currentIndex === selectedIndex;
                currentIndex++;
                
                return (
                  <button
                    key={cmd.id}
                    className={`
                      w-full px-3 py-2 flex items-center justify-between rounded-lg transition-colors
                      ${isSelected ? 'bg-iris/10 text-iris' : 'hover:bg-surface/60 text-text'}
                    `}
                    onClick={() => onCommand(cmd.action)}
                    onMouseEnter={() => setSelectedIndex(filteredCommands.indexOf(cmd))}
                  >
                    <span className="text-sm">{cmd.label}</span>
                    {cmd.shortcut && (
                      <span className="text-xs text-muted font-mono">{cmd.shortcut}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          
          {filteredCommands.length === 0 && (
            <div className="py-8 text-center text-sm text-muted">
              No commands found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
