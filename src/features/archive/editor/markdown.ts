// Markdown parser and serializer for the editor

export type BlockType = 
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'checklist'
  | 'quote'
  | 'code'
  | 'divider';

export type InlineMark = 'bold' | 'italic' | 'underline' | 'code' | 'link';

export interface Block {
  id: string;
  type: BlockType;
  content?: string;
  level?: number; // For headings
  ordered?: boolean; // For lists
  items?: any[]; // For lists/checklists
  language?: string; // For code blocks
  marks?: InlineMark[]; // Inline formatting
}

export interface ChecklistItem {
  checked: boolean;
  text: string;
}

// Parse markdown text into blocks
export function parseMarkdown(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let currentBlock: Block | null = null;
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeContent: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({
          id: generateId(),
          type: 'code',
          language: codeLanguage,
          content: codeContent.join('\n')
        });
        codeContent = [];
        codeLanguage = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim();
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }
    
    // Divider
    if (/^---+$|^\*\*\*+$|^___+$/.test(line.trim())) {
      blocks.push({ id: generateId(), type: 'divider' });
      continue;
    }
    
    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      blocks.push({
        id: generateId(),
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        content: parseInline(headingMatch[2])
      });
      continue;
    }
    
    // Quote
    if (line.startsWith('>')) {
      const content = line.replace(/^>\s*/, '');
      if (currentBlock && currentBlock.type === 'quote') {
        currentBlock.content += '\n' + content;
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = {
          id: generateId(),
          type: 'quote',
          content: parseInline(content)
        };
      }
      continue;
    }
    
    // Lists and checklists
    const listMatch = line.match(/^(\s*)([*\-+]|\d+\.)\s+(\[[ x]\]\s+)?(.+)/);
    if (listMatch) {
      const [, indent, marker, checkbox, content] = listMatch;
      const ordered = /\d+\./.test(marker);
      const isChecklist = !!checkbox;
      
      if (isChecklist) {
        const checked = checkbox.includes('x');
        if (currentBlock && currentBlock.type === 'checklist') {
          currentBlock.items!.push({ checked, text: parseInline(content) });
        } else {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = {
            id: generateId(),
            type: 'checklist',
            items: [{ checked, text: parseInline(content) }]
          };
        }
      } else {
        if (currentBlock && currentBlock.type === 'list' && currentBlock.ordered === ordered) {
          currentBlock.items!.push(parseInline(content));
        } else {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = {
            id: generateId(),
            type: 'list',
            ordered,
            items: [parseInline(content)]
          };
        }
      }
      continue;
    }
    
    // Empty line - end current block
    if (line.trim() === '') {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }
    
    // Paragraph
    if (currentBlock && currentBlock.type === 'paragraph') {
      currentBlock.content += ' ' + parseInline(line);
    } else {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = {
        id: generateId(),
        type: 'paragraph',
        content: parseInline(line)
      };
    }
  }
  
  // Add remaining block
  if (currentBlock) blocks.push(currentBlock);
  
  // Ensure at least one block
  if (blocks.length === 0) {
    blocks.push({
      id: generateId(),
      type: 'paragraph',
      content: ''
    });
  }
  
  return blocks;
}

// Serialize blocks back to markdown
export function serializeMarkdown(blocks: Block[]): string {
  return blocks.map(block => {
    switch (block.type) {
      case 'heading':
        return `${'#'.repeat(block.level || 1)} ${block.content || ''}`;
        
      case 'paragraph':
        return block.content || '';
        
      case 'list':
        const marker = block.ordered ? '1.' : '-';
        return (block.items || []).map(item => `${marker} ${item}`).join('\n');
        
      case 'checklist':
        return (block.items || []).map((item: ChecklistItem) => 
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
}

// Parse inline markdown (bold, italic, code, etc.)
export function parseInline(text: string): string {
  // For now, preserve the raw markdown
  // In a full implementation, this would create a rich text structure
  return text;
}

// Apply inline mark to text
export function applyMark(text: string, mark: InlineMark): string {
  switch (mark) {
    case 'bold':
      return `**${text}**`;
    case 'italic':
      return `*${text}*`;
    case 'underline':
      return `<u>${text}</u>`;
    case 'code':
      return `\`${text}\``;
    default:
      return text;
  }
}

// Remove inline mark from text
export function removeMark(text: string, mark: InlineMark): string {
  switch (mark) {
    case 'bold':
      return text.replace(/\*\*(.*?)\*\*/g, '$1');
    case 'italic':
      return text.replace(/\*(.*?)\*/g, '$1');
    case 'underline':
      return text.replace(/<u>(.*?)<\/u>/g, '$1');
    case 'code':
      return text.replace(/`(.*?)`/g, '$1');
    default:
      return text;
  }
}

// Generate unique block ID
function generateId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
