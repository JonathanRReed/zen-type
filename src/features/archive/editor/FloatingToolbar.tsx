// Floating toolbar for text formatting
import React from 'react';

interface FloatingToolbarProps {
  position: { x: number; y: number };
  onCommand: (command: string, args?: any) => void;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({ position, onCommand }) => {
  const buttons = [
    { command: 'toggleBold', icon: 'B', title: 'Bold (⌘B)' },
    { command: 'toggleItalic', icon: 'I', title: 'Italic (⌘I)' },
    { command: 'toggleUnderline', icon: 'U', title: 'Underline (⌘U)' },
    { command: 'toggleCode', icon: '<>', title: 'Code (⌘⇧C)' },
    { command: 'createLink', icon: 'link', title: 'Link' },
  ];

  return (
    <div
      className="floating-toolbar fixed z-50 glass rounded-lg border border-muted/20 shadow-lg flex items-center gap-1 p-1"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)'
      }}
    >
      {buttons.map(({ command, icon, title }) => (
        <button
          key={command}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface/60 text-text hover:text-iris transition-colors text-sm font-mono"
          title={title}
          onClick={() => onCommand(command)}
          onMouseDown={(e) => e.preventDefault()} // Prevent selection loss
          aria-label={title}
        >
          {icon === 'link' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L10 4"/>
              <path d="M14 11a5 5 0 01-7.07 0L4.1 8.17a5 5 0 017.07-7.07L14 3"/>
            </svg>
          ) : (
            <span>{icon}</span>
          )}
        </button>
      ))}
    </div>
  );
};
