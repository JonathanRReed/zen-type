// Properties panel for document metadata
import React, { useState, useEffect } from 'react';
import { TagStore, type Document, type Tag } from '../db';

interface PropertiesPanelProps {
  document: Document;
  tags: Tag[];
  onUpdateDocument: (updates: Partial<Document>) => Promise<void>;
  onAddTag: (docId: string, tagId: string) => Promise<void>;
  onRemoveTag: (docId: string, tagId: string) => Promise<void>;
  onShowRevisions: () => void;
  onToggleFocusMode: () => void;
  onToggleTypewriter: () => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  document,
  tags,
  onUpdateDocument,
  onAddTag,
  onRemoveTag,
  onShowRevisions,
  onToggleFocusMode,
  onToggleTypewriter
}) => {
  const [documentTags, setDocumentTags] = useState<Tag[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(document.title);

  useEffect(() => {
    const loadDocumentTags = async () => {
      if (document.id) {
        const tags = await TagStore.getDocumentTags(document.id);
        setDocumentTags(tags);
      }
    };
    loadDocumentTags();
  }, [document.id]);

  useEffect(() => {
    setTitle(document.title);
  }, [document.title]);


  const handleSaveTitle = async () => {
    if (title !== document.title) {
      await onUpdateDocument({ title });
    }
    setEditingTitle(false);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const readingTime = Math.ceil(document.wordCount / 200);

  return (
    <div className="w-80 bg-surface/40 border-l border-muted/20 p-4 overflow-y-auto">
      {/* Title */}
      <div className="mb-6">
        <div className="text-xs text-muted uppercase tracking-wider mb-2">
          Title
        </div>
        {editingTitle ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveTitle();
              if (e.key === 'Escape') {
                setTitle(document.title);
                setEditingTitle(false);
              }
            }}
            className="w-full px-2 py-1 bg-surface/60 border border-muted/20 rounded outline-none focus:border-iris/40"
          />
        ) : (
          <button
            className="w-full text-left px-2 py-1 cursor-pointer hover:bg-surface/40 rounded"
            onClick={() => setEditingTitle(true)}
          >
            {document.title || 'Untitled'}
          </button>
        )}
      </div>

      {/* Tags */}
      <div className="mb-6">
        <div className="text-xs text-muted uppercase tracking-wider mb-2">
          Tags
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {documentTags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              {tag.name}
              <button
                onClick={() => tag.id && document.id && onRemoveTag(document.id, tag.id)}
                className="w-3 h-3 flex items-center justify-center rounded-full hover:bg-overlay/20"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <select
          onChange={async (e) => {
            if (e.target.value && document.id) {
              await onAddTag(document.id, e.target.value);
              // Re-load tags
              if (document.id) {
                const tags = await TagStore.getDocumentTags(document.id);
                setDocumentTags(tags);
              }
              e.target.value = '';
            }
          }}
          className="w-full px-2 py-1 bg-surface/60 border border-muted/20 rounded text-sm"
          defaultValue=""
        >
          <option value="">Add tag...</option>
          {tags.filter(t => !documentTags.find(dt => dt.id === t.id)).map(tag => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </div>

      {/* Statistics */}
      <div className="mb-6 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Words</span>
          <span className="text-text font-mono">{document.wordCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Characters</span>
          <span className="text-text font-mono">{document.charCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Reading time</span>
          <span className="text-text font-mono">{readingTime} min</span>
        </div>
      </div>

      {/* Timestamps */}
      <div className="mb-6 space-y-2">
        <div className="text-xs text-muted">
          Created: {formatDate(document.createdAt)}
        </div>
        <div className="text-xs text-muted">
          Updated: {formatDate(document.updatedAt)}
        </div>
        {document.sourceSessionId && (
          <div className="text-xs text-muted">
            From session: {document.sourceSessionId}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={onShowRevisions}
          className="w-full px-3 py-2 bg-surface/60 border border-muted/20 rounded-lg text-sm hover:bg-surface/80 transition-colors"
        >
          View Revisions
        </button>
        
        <button
          onClick={async () => {
            const markdown = document.content;
            const blob = new Blob([markdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = window.document.createElement('a');
            a.href = url;
            a.download = `${document.title || 'document'}.md`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="w-full px-3 py-2 bg-surface/60 border border-muted/20 rounded-lg text-sm hover:bg-surface/80 transition-colors"
        >
          Export as Markdown
        </button>
        
        <button
          onClick={async () => {
            const json = JSON.stringify(document, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = window.document.createElement('a');
            a.href = url;
            a.download = `${document.title || 'document'}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="w-full px-3 py-2 bg-surface/60 border border-muted/20 rounded-lg text-sm hover:bg-surface/80 transition-colors"
        >
          Export as JSON
        </button>
      </div>

      {/* View Options */}
      <div className="mt-6 pt-6 border-t border-muted/20 space-y-2">
        <h3 className="text-xs text-muted uppercase tracking-wider mb-3">View Options</h3>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            onChange={onToggleFocusMode}
            className="rounded"
          />
          <span className="text-sm">Focus Mode</span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            onChange={onToggleTypewriter}
            className="rounded"
          />
          <span className="text-sm">Typewriter Mode</span>
        </label>
      </div>
    </div>
  );
};
