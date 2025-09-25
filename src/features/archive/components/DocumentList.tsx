// Document list component
import React, { useRef } from 'react';
import type { Document } from '../db';

interface DocumentListProps {
  documents: Document[];
  selectedDocId: string | null;
  onSelect: (docId: string) => void;
  onDelete?: (docId: string) => void;
  onRestore?: (docId: string) => void;
  onToggleFavorite?: (docId: string) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  selectedDocId,
  onSelect,
  onDelete,
  onRestore,
  onToggleFavorite
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  
  // Format date
  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes === 0 ? 'Just now' : `${minutes}m ago`;
      }
      return `${hours}h ago`;
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return d.toLocaleDateString();
    }
  };

  // Virtual scrolling placeholder - would use a library for production
  // const itemHeight = 80;
  // const visibleItems = Math.ceil(window.innerHeight / itemHeight);

  if (documents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-muted">No documents found</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto">
      {documents.map((doc) => {
        const preview = doc.content.substring(0, 120).replace(/\n/g, ' ');
        
        return (
          <div
            key={doc.id}
            role="button"
            tabIndex={0}
            className={`
              border-b border-muted/10 p-4 cursor-pointer transition-colors
              ${selectedDocId === doc.id ? 'bg-iris/5' : 'hover:bg-surface/40'}
            `}
            onClick={() => doc.id && onSelect(doc.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                doc.id && onSelect(doc.id);
              }
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-text truncate">
                    {doc.title || 'Untitled'}
                  </h3>
                  {doc.favorite && (
                    <span className="text-gold" title="Favorite">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                      </svg>
                    </span>
                  )}
                  {doc.sourceSessionId && (
                    <span className="text-xs text-muted px-1.5 py-0.5 bg-surface/60 rounded">
                      Session
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-muted truncate mb-2">
                  {preview || 'Empty document'}
                </p>
                
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>{formatDate(doc.updatedAt)}</span>
                  <span>{doc.wordCount} words</span>
                  <span>{doc.charCount} chars</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {onToggleFavorite && (
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface/60"
                    onClick={(e) => {
                      e.stopPropagation();
                      doc.id && onToggleFavorite(doc.id);
                    }}
                    aria-label={doc.favorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {doc.favorite ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gold" aria-hidden="true">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted" aria-hidden="true">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                      </svg>
                    )}
                  </button>
                )}
                
                {onRestore && (
                  <button
                    className="px-2 h-8 flex items-center justify-center rounded hover:bg-surface/60 text-foam text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      doc.id && onRestore(doc.id);
                    }}
                    aria-label="Restore document"
                  >
                    Restore
                  </button>
                )}
                
                {onDelete && (
                  <button
                    className="px-2 h-8 flex items-center justify-center rounded hover:bg-surface/60 text-love text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      doc.id && onDelete(doc.id);
                    }}
                    aria-label="Delete document"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
