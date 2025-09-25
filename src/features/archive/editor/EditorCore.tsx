// Core WYSIWYM Markdown Editor Component
import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { DocumentStore, type Document } from '../db';
import { SlashMenu } from './SlashMenu';
import { FloatingToolbar } from './FloatingToolbar';
import { CommandPalette } from './CommandPalette';
import { FindReplace } from './FindReplace';
import { parseMarkdown, serializeMarkdown, type Block, type InlineMark } from './markdown';
import { useEditorCommands } from './hooks/useEditorCommands';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { debounce } from '../../../utils/debounce';

interface EditorCoreProps {
  document: Document;
  onUpdate?: (content: string) => void;
  onSave?: () => void;
  focusMode?: boolean;
  typewriterMode?: boolean;
  className?: string;
}

export const EditorCore: React.FC<EditorCoreProps> = ({
  document,
  onUpdate,
  onSave,
  focusMode = false,
  typewriterMode = false,
  className = ''
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selection, setSelection] = useState<Range | null>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);
  const [floatingToolbarPosition, setFloatingToolbarPosition] = useState({ x: 0, y: 0 });
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [wordCount, setWordCount] = useState(document.wordCount);
  const [charCount, setCharCount] = useState(document.charCount);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  // Parse initial content
  useEffect(() => {
    const parsed = parseMarkdown(document.content);
    setBlocks(parsed);
  }, [document.id]);

  // Editor commands
  const { executeCommand } = useEditorCommands(editorRef, blocks, setBlocks);

  // Keyboard shortcuts
  useKeyboardShortcuts(editorRef, {
    'Mod+B': () => executeCommand('toggleBold'),
    'Mod+I': () => executeCommand('toggleItalic'),
    'Mod+U': () => executeCommand('toggleUnderline'),
    'Mod+Shift+C': () => executeCommand('toggleCode'),
    'Mod+Shift+L': () => executeCommand('toggleChecklist'),
    'Mod+K': () => setShowCommandPalette(true),
    'Mod+F': () => setShowFindReplace(true),
    'Mod+S': () => {
      saveContent();
      onSave?.();
    },
    'Escape': () => {
      setShowSlashMenu(false);
      setShowFloatingToolbar(false);
      setShowCommandPalette(false);
      setShowFindReplace(false);
    },
    '/': (e) => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSlashMenuPosition({ x: rect.left, y: rect.bottom + 5 });
        setShowSlashMenu(true);
        e.preventDefault();
      }
    }
  });

  // Auto-save with debouncing
  const debouncedSave = useMemo(
    () => debounce((content: string, words: number, chars: number) => {
      DocumentStore.update(document.id!, { 
        content,
        wordCount: words,
        charCount: chars 
      });
    }, 1500),
    [document.id]
  );

  // Save content
  const saveContent = useCallback(() => {
    if (!editorRef.current) return;
    
    const content = serializeMarkdown(blocks);
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const chars = content.length;
    
    setWordCount(words);
    setCharCount(chars);
    
    onUpdate?.(content);
    debouncedSave(content, words, chars);
  }, [blocks, onUpdate, debouncedSave]);

  // Handle content changes
  const handleContentChange = useCallback(() => {
    if (!editorRef.current) return;
    
    // Re-parse blocks from DOM
    const newBlocks = parseDOMToBlocks(editorRef.current);
    setBlocks(newBlocks);
    saveContent();
  }, [saveContent]);

  // Parse DOM back to blocks
  const parseDOMToBlocks = (container: HTMLElement): Block[] => {
    const blocks: Block[] = [];
    const children = Array.from(container.children);
    
    children.forEach((child) => {
      const block = parseElementToBlock(child as HTMLElement);
      if (block) blocks.push(block);
    });
    
    return blocks;
  };

  // Parse single element to block
  const parseElementToBlock = (element: HTMLElement): Block | null => {
    const id = element.dataset.blockId || generateBlockId();
    const content = element.textContent || '';
    
    switch (element.tagName.toLowerCase()) {
      case 'h1':
        return { id, type: 'heading', level: 1, content };
      case 'h2':
        return { id, type: 'heading', level: 2, content };
      case 'h3':
        return { id, type: 'heading', level: 3, content };
      case 'ul':
        return { id, type: 'list', ordered: false, items: parseListItems(element) };
      case 'ol':
        return { id, type: 'list', ordered: true, items: parseListItems(element) };
      case 'blockquote':
        return { id, type: 'quote', content };
      case 'pre':
        return { id, type: 'code', language: element.dataset.language || '', content };
      case 'hr':
        return { id, type: 'divider' };
      case 'p':
      default:
        return { id, type: 'paragraph', content };
    }
  };

  // Parse list items
  const parseListItems = (list: HTMLElement): string[] => {
    return Array.from(list.querySelectorAll('li')).map(li => li.textContent || '');
  };

  // Generate block ID
  const generateBlockId = () => `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Handle selection change
  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setShowFloatingToolbar(false);
      return;
    }
    
    const range = sel.getRangeAt(0);
    const text = range.toString();
    
    if (text.length > 0) {
      const rect = range.getBoundingClientRect();
      setFloatingToolbarPosition({
        x: rect.left + (rect.width / 2),
        y: rect.top - 40
      });
      setShowFloatingToolbar(true);
      setSelection(range);
    } else {
      setShowFloatingToolbar(false);
    }
  }, []);

  // Handle focus change for focus mode
  const handleFocus = useCallback((e: FocusEvent) => {
    if (!focusMode || !editorRef.current) return;
    
    const target = e.target as HTMLElement;
    const block = target.closest('[data-block-id]') as HTMLElement;
    
    if (block) {
      setActiveBlockId(block.dataset.blockId || null);
    }
  }, [focusMode]);

  // Render blocks to JSX
  const renderBlocks = () => {
    return blocks.map((block) => {
      const isActive = focusMode && block.id === activeBlockId;
      const blockClass = `
        block transition-opacity duration-200
        ${focusMode && !isActive ? 'opacity-40' : 'opacity-100'}
        ${typewriterMode ? 'typewriter-block' : ''}
      `;
      
      switch (block.type) {
        case 'heading':
          const HeadingTag = `h${block.level}` as keyof JSX.IntrinsicElements;
          return (
            <HeadingTag 
              key={block.id} 
              data-block-id={block.id}
              className={`${blockClass} ${block.level === 1 ? 'text-3xl font-bold' : block.level === 2 ? 'text-2xl font-semibold' : 'text-xl font-medium'} mb-4`}
              contentEditable
              suppressContentEditableWarning
              onBlur={handleContentChange}
            >
              {block.content}
            </HeadingTag>
          );
          
        case 'paragraph':
          return (
            <p
              key={block.id}
              data-block-id={block.id}
              className={`${blockClass} mb-4`}
              contentEditable
              suppressContentEditableWarning
              onBlur={handleContentChange}
            >
              {block.content}
            </p>
          );
          
        case 'list':
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag
              key={block.id}
              data-block-id={block.id}
              className={`${blockClass} mb-4 ${block.ordered ? 'list-decimal' : 'list-disc'} list-inside`}
            >
              {block.items.map((item, idx) => (
                <li 
                  key={idx}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={handleContentChange}
                >
                  {item}
                </li>
              ))}
            </ListTag>
          );
          
        case 'checklist':
          return (
            <div 
              key={block.id}
              data-block-id={block.id}
              className={`${blockClass} mb-4`}
            >
              {block.items.map((item, idx) => (
                <label key={idx} className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => {
                      const newBlocks = [...blocks];
                      const blockIndex = newBlocks.findIndex(b => b.id === block.id);
                      if (blockIndex !== -1 && newBlocks[blockIndex].type === 'checklist') {
                        const checklistBlock = newBlocks[blockIndex] as any;
                        checklistBlock.items[idx].checked = !item.checked;
                        setBlocks(newBlocks);
                        saveContent();
                      }
                    }}
                    className="rounded"
                  />
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={handleContentChange}
                    className={item.checked ? 'line-through opacity-60' : ''}
                  >
                    {item.text}
                  </span>
                </label>
              ))}
            </div>
          );
          
        case 'quote':
          return (
            <blockquote
              key={block.id}
              data-block-id={block.id}
              className={`${blockClass} border-l-4 border-iris/40 pl-4 italic mb-4`}
              contentEditable
              suppressContentEditableWarning
              onBlur={handleContentChange}
            >
              {block.content}
            </blockquote>
          );
          
        case 'code':
          return (
            <pre
              key={block.id}
              data-block-id={block.id}
              data-language={block.language}
              className={`${blockClass} bg-overlay/60 rounded-lg p-4 overflow-x-auto mb-4`}
            >
              <code
                contentEditable
                suppressContentEditableWarning
                onBlur={handleContentChange}
                className="font-mono text-sm"
              >
                {block.content}
              </code>
            </pre>
          );
          
        case 'divider':
          return (
            <hr
              key={block.id}
              data-block-id={block.id}
              className="border-muted/30 my-6"
            />
          );
          
        default:
          return null;
      }
    });
  };

  // Typewriter scroll effect
  useEffect(() => {
    if (!typewriterMode || !editorRef.current) return;
    
    const handleScroll = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const editorRect = editorRef.current!.getBoundingClientRect();
      const targetY = editorRect.height / 2;
      
      if (Math.abs(rect.top - targetY) > 50) {
        editorRef.current!.scrollTo({
          top: editorRef.current!.scrollTop + (rect.top - targetY),
          behavior: 'smooth'
        });
      }
    };
    
    const interval = setInterval(handleScroll, 100);
    return () => clearInterval(interval);
  }, [typewriterMode]);

  // Setup event listeners
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    editorRef.current?.addEventListener('focus', handleFocus, true);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      editorRef.current?.removeEventListener('focus', handleFocus, true);
    };
  }, [handleSelectionChange, handleFocus]);

  return (
    <div className={`editor-core relative ${className}`}>
      <div
        ref={editorRef}
        className="editor-content prose prose-invert max-w-none outline-none focus:outline-none"
        style={{ 
          minHeight: '60vh',
          caretColor: 'var(--rp-iris)'
        }}
      >
        {renderBlocks()}
      </div>

      {/* Status bar */}
      <div className="editor-status fixed bottom-4 right-4 flex items-center gap-4 text-xs text-muted font-mono">
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
        <span>{Math.ceil(wordCount / 200)} min read</span>
      </div>

      {/* Slash menu */}
      {showSlashMenu && (
        <SlashMenu
          position={slashMenuPosition}
          onSelect={(type) => {
            executeCommand('insertBlock', { type });
            setShowSlashMenu(false);
          }}
          onClose={() => setShowSlashMenu(false)}
        />
      )}

      {/* Floating toolbar */}
      {showFloatingToolbar && (
        <FloatingToolbar
          position={floatingToolbarPosition}
          onCommand={executeCommand}
        />
      )}

      {/* Command palette */}
      {showCommandPalette && (
        <CommandPalette
          onCommand={(cmd) => {
            executeCommand(cmd);
            setShowCommandPalette(false);
          }}
          onClose={() => setShowCommandPalette(false)}
        />
      )}

      {/* Find/Replace */}
      {showFindReplace && (
        <FindReplace
          content={serializeMarkdown(blocks)}
          onReplace={(newContent) => {
            const parsed = parseMarkdown(newContent);
            setBlocks(parsed);
            saveContent();
          }}
          onClose={() => setShowFindReplace(false)}
        />
      )}
    </div>
  );
};

export default EditorCore;
