// Editor commands hook
import { useCallback } from 'react';
import { Block, BlockType, applyMark, removeMark } from '../markdown';

export function useEditorCommands(
  editorRef: React.RefObject<HTMLDivElement>,
  blocks: Block[],
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>
) {
  const executeCommand = useCallback((command: string, args?: any) => {
    const selection = window.getSelection();
    
    switch (command) {
      case 'toggleBold':
        document.execCommand('bold', false);
        break;
        
      case 'toggleItalic':
        document.execCommand('italic', false);
        break;
        
      case 'toggleUnderline':
        document.execCommand('underline', false);
        break;
        
      case 'toggleCode':
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const text = range.toString();
          const code = document.createElement('code');
          code.textContent = text;
          range.deleteContents();
          range.insertNode(code);
        }
        break;
        
      case 'createLink':
        const url = prompt('Enter URL:');
        if (url) {
          document.execCommand('createLink', false, url);
        }
        break;
        
      case 'insertBlock':
        if (args?.type) {
          insertBlock(args.type as BlockType);
        }
        break;
        
      case 'toggleChecklist':
        toggleChecklistBlock();
        break;
        
      case 'undo':
        document.execCommand('undo', false);
        break;
        
      case 'redo':
        document.execCommand('redo', false);
        break;
        
      case 'save':
        // Trigger save through parent component
        break;
        
      case 'exportMarkdown':
        exportAsMarkdown();
        break;
        
      case 'exportJSON':
        exportAsJSON();
        break;
        
      case 'print':
        window.print();
        break;
        
      case 'toggleFocusMode':
        // Handle through parent component
        break;
        
      case 'toggleTypewriter':
        // Handle through parent component
        break;
        
      case 'toggleFullscreen':
        if (!document.fullscreenElement) {
          editorRef.current?.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
        break;
    }
  }, [blocks, setBlocks, editorRef]);

  const insertBlock = useCallback((type: BlockType) => {
    const newBlock: Block = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content: type === 'divider' ? undefined : '',
      level: type === 'heading' ? 1 : undefined,
      ordered: type === 'list' ? false : undefined,
      items: type === 'list' || type === 'checklist' ? [] : undefined,
      language: type === 'code' ? '' : undefined
    };
    
    // Find current cursor position and insert after current block
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.startContainer;
      const blockEl = (container as Node).nodeType === Node.TEXT_NODE
        ? (container as Node).parentElement?.closest('[data-block-id]')
        : (container as Element).closest('[data-block-id]');
        
      if (blockEl) {
        const currentBlockId = (blockEl as HTMLElement).dataset.blockId;
        const currentIndex = blocks.findIndex(b => b.id === currentBlockId);
        
        if (currentIndex !== -1) {
          const newBlocks = [...blocks];
          newBlocks.splice(currentIndex + 1, 0, newBlock);
          setBlocks(newBlocks);
          
          // Focus new block after render
          setTimeout(() => {
            const newBlockEl = editorRef.current?.querySelector(`[data-block-id="${newBlock.id}"]`);
            if (newBlockEl && newBlockEl instanceof HTMLElement) {
              newBlockEl.focus();
            }
          }, 0);
        }
      }
    } else {
      // Add to end if no selection
      setBlocks([...blocks, newBlock]);
    }
  }, [blocks, setBlocks, editorRef]);

  const toggleChecklistBlock = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    const blockEl = (container as Node).nodeType === Node.TEXT_NODE
      ? (container as Node).parentElement?.closest('[data-block-id]')
      : (container as Element).closest('[data-block-id]');
      
    if (blockEl) {
      const blockId = (blockEl as HTMLElement).dataset.blockId;
      const blockIndex = blocks.findIndex(b => b.id === blockId);
      
      if (blockIndex !== -1) {
        const block = blocks[blockIndex];
        const newBlocks = [...blocks];
        
        if (block.type === 'checklist') {
          // Convert to paragraph
          newBlocks[blockIndex] = {
            ...block,
            type: 'paragraph',
            content: (block.items as any[])?.map(item => item.text).join('\n') || '',
            items: undefined
          };
        } else {
          // Convert to checklist
          const lines = (block.content || '').split('\n').filter(Boolean);
          newBlocks[blockIndex] = {
            ...block,
            type: 'checklist',
            items: lines.map(line => ({ checked: false, text: line })),
            content: undefined
          };
        }
        
        setBlocks(newBlocks);
      }
    }
  }, [blocks, setBlocks]);

  const exportAsMarkdown = useCallback(() => {
    const markdown = blocks.map(block => {
      // Use the serializeMarkdown logic here
      switch (block.type) {
        case 'heading':
          return `${'#'.repeat(block.level || 1)} ${block.content || ''}`;
        case 'paragraph':
          return block.content || '';
        case 'list':
          const marker = block.ordered ? '1.' : '-';
          return (block.items || []).map(item => `${marker} ${item}`).join('\n');
        case 'checklist':
          return (block.items || []).map((item: any) => 
            `- [${item.checked ? 'x' : ' '}] ${item.text}`
          ).join('\n');
        case 'quote':
          return (block.content || '').split('\n').map(line => `> ${line}`).join('\n');
        case 'code':
          return `\`\`\`${block.language || ''}\n${block.content || ''}\n\`\`\``;
        case 'divider':
          return '---';
        default:
          return '';
      }
    }).filter(Boolean).join('\n\n');
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [blocks]);

  const exportAsJSON = useCallback(() => {
    const json = JSON.stringify({ blocks }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [blocks]);

  return { executeCommand };
}
