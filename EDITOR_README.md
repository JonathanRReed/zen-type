# Zen Typer Library & Editor Documentation

## Overview

The Zen Typer Library is a full-featured local-first text editor with robust document management, version control, and a refined writing experience. Built with Astro, React, TypeScript, and Tailwind CSS, it provides a professional writing environment with seamless integration to Zen and Quote typing modes.

## Key Features

### Storage System
- **IndexedDB Backend**: Uses Dexie for robust local storage
- **Automatic Migration**: Seamlessly migrates from localStorage to IndexedDB
- **Document Management**: Full CRUD operations with metadata tracking
- **Version Control**: Snapshot + diff revision system with restore capability
- **Tag System**: Organize documents with colored tags
- **Session Tracking**: Preserves Zen/Quote mode sessions with provenance

### Library UI
- **Multi-View Navigation**:
  - All Documents
  - Favorites
  - Tags (with filtering)
  - Today's Documents
  - Zen Captures
  - Quote Captures
  - Trash (with 30-day retention)
  
- **Document List Features**:
  - Fuzzy search with Fuse.js
  - Sort by updated, created, or title
  - Virtual scrolling for performance
  - Quick actions (favorite, delete, restore)
  
- **Properties Panel**:
  - Editable title
  - Tag management
  - Word/character counts
  - Reading time estimation
  - Creation/update timestamps
  - Session provenance links

### Editor Features

#### WYSIWYM Markdown Editor
- **Block Types**:
  - Paragraphs
  - Headings (H1-H3)
  - Ordered/unordered lists
  - Checklists with toggles
  - Blockquotes
  - Code blocks with language hints
  - Horizontal dividers

- **Inline Formatting**:
  - Bold (⌘B)
  - Italic (⌘I)
  - Underline (⌘U)
  - Inline code (⌘⇧C)
  - Links

- **Writing Tools**:
  - **Slash Menu** (`/`): Quick block insertion
  - **Floating Toolbar**: Format selected text
  - **Command Palette** (⌘K): All commands and navigation
  - **Find & Replace** (⌘F): With regex support
  - **Auto-save**: 1.5s debounced saves
  - **Live Statistics**: Word count, character count, reading time

- **Writing Modes**:
  - **Focus Mode**: Dims inactive blocks
  - **Typewriter Mode**: Keeps cursor centered
  - **Fullscreen**: Distraction-free writing

### Revision System
- **Smart Snapshots**: Full saves every 5 minutes or 20 edits
- **Incremental Diffs**: Small changes between snapshots
- **Visual Diff Viewer**: See additions/removals
- **One-Click Restore**: Revert to any previous version
- **Storage Optimized**: Minimizes space with compression

### Import/Export
- **Import Formats**:
  - Markdown files (`.md`)
  - JSON documents
  - ZIP archives (full library backup)
  
- **Export Options**:
  - Individual documents as Markdown
  - Individual documents as JSON
  - Full library as ZIP archive
  - Preserves tags and metadata

### Zen/Quote Mode Integration
- **Session Handoff**: "Save to Library" after sessions
- **Automatic Conversion**: Sessions become editable documents
- **Provenance Tracking**: Links documents to original sessions
- **Timeline Integration**: Open segments in editor

## Keyboard Shortcuts

### Global
- `⌘K` - Open command palette
- `⌘N` - New document
- `⌘S` - Save (force snapshot)
- `⌘L` - Go to Library
- `Escape` - Close dialogs/menus

### Editor
- `⌘B` - Bold
- `⌘I` - Italic
- `⌘U` - Underline
- `⌘⇧C` - Inline code
- `⌘⇧L` - Toggle checklist
- `⌘F` - Find
- `⌘⇧F` - Replace
- `/` - Open slash menu
- `⌘P` - Print view

### Navigation
- `↑↓` - Navigate menus
- `Enter` - Select/confirm
- `Tab` - Next field
- `⇧Tab` - Previous field

## Data Model

### Database Schema
```typescript
// Documents
{
  id: string
  title: string
  content: string
  createdAt: Date
  updatedAt: Date
  wordCount: number
  charCount: number
  favorite?: boolean
  trashed?: boolean
  sourceSessionId?: string // Link to Zen/Quote session
}

// Revisions
{
  id: string
  docId: string
  timestamp: Date
  type: 'snapshot' | 'diff'
  content: string // Full text or diff
  summary: string
}

// Tags
{
  id: string
  name: string
  color: string // Hex color
}

// Sessions (Zen/Quote captures)
{
  id: string
  type: 'zen' | 'quote'
  startedAt: Date
  endedAt?: Date
  text: string
  wordCount: number
  quote?: string // For quote mode
  author?: string
}
```

## Performance Optimizations

- **Virtual Scrolling**: Large document lists render only visible items
- **Debounced Saves**: Reduces write operations
- **Lazy Loading**: Components load on-demand
- **Block-Level Rendering**: Editor renders only visible blocks
- **Indexed Search**: Pre-built search indices for fast queries
- **Web Workers**: Heavy operations run off main thread

## Accessibility

- **Keyboard Navigation**: All features accessible via keyboard
- **Screen Reader Support**: Proper ARIA labels and roles
- **Focus Management**: Clear focus indicators
- **Reduced Motion**: Respects user preference
- **High Contrast**: Enhanced visibility when enabled

## Security Features

- **Local-Only Storage**: No cloud dependencies
- **Optional Encryption**: AES-GCM for sensitive documents (future)
- **Passphrase Lock**: Protect library access (future)
- **Secure Export**: Encrypted ZIP backups (future)

## Backup & Recovery

### Manual Backup
1. Open Library
2. Click Import/Export
3. Export Library (.zip)
4. Store ZIP file safely

### Restore Process
1. Open Library
2. Click Import/Export
3. Choose backup ZIP file
4. Confirm import

### Trash Recovery
- Documents remain in trash for 30 days
- Restore with one click
- Permanent delete requires confirmation

## Usage Examples

### Creating a Document from Zen Session
```typescript
// After Zen session ends
const sessionId = await SessionStore.create({
  type: 'zen',
  text: capturedText,
  wordCount: words,
  // ...
});

// Convert to document
const docId = await SessionStore.convertToDocument(sessionId);
```

### Tagging Documents
```typescript
// Create tag
const tagId = await TagStore.create('Research', '#9ccfd8');

// Add to document
await TagStore.addToDocument(docId, tagId);
```

### Exporting Documents
```typescript
// Export single document
const doc = await DocumentStore.get(docId);
const markdown = doc.content;
// Download as file...

// Export entire library
const docs = await DocumentStore.getAll();
const zip = new JSZip();
// Add documents to ZIP...
```

## Troubleshooting

### Library Won't Open
- Check browser console for errors
- Clear site data and refresh
- Ensure IndexedDB is enabled

### Lost Documents
- Check Trash view first
- Look for auto-saved revisions
- Import from last backup

### Performance Issues
- Enable Performance Mode in settings
- Clear old revisions periodically
- Limit open documents

## Future Enhancements

- [ ] Collaborative editing via WebRTC
- [ ] Cloud sync with end-to-end encryption
- [ ] Plugin system for extensions
- [ ] Mobile app with sync
- [ ] Advanced markdown (tables, footnotes)
- [ ] Citation management
- [ ] Writing statistics dashboard
- [ ] AI writing assistant integration
