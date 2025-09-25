// Keyboard shortcuts hook
import { useEffect } from 'react';

type KeyboardShortcut = {
  [key: string]: (e: KeyboardEvent) => void;
};

export function useKeyboardShortcuts(
  editorRef: React.RefObject<HTMLElement>,
  shortcuts: KeyboardShortcut
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Build shortcut string
      const parts: string[] = [];
      
      if (e.metaKey || e.ctrlKey) parts.push('Mod');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      
      // Normalize key
      let key = e.key;
      if (key === ' ') key = 'Space';
      if (key.length === 1) key = key.toUpperCase();
      
      parts.push(key);
      const shortcut = parts.join('+');
      
      // Check if this shortcut is registered
      if (shortcuts[shortcut]) {
        // Only handle if editor is focused
        if (editorRef.current?.contains(document.activeElement)) {
          shortcuts[shortcut](e);
        }
      } else if (shortcuts[e.key]) {
        // Check for single key shortcuts
        if (editorRef.current?.contains(document.activeElement)) {
          shortcuts[e.key](e);
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, editorRef]);
}
