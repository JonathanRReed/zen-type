// Sidebar component for the Library
import React from 'react';
import type { Tag } from '../db';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: any) => void;
  tags: Tag[];
  selectedTag: string | null;
  onTagSelect: (tagId: string | null) => void;
  onNewDocument: () => void;
  onImportExport: () => void;
  documentCounts: {
    all: number;
    favorites: number;
    trash: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  tags,
  selectedTag,
  onTagSelect,
  onNewDocument,
  onImportExport,
  documentCounts
}) => {
  const views = [
    { id: 'all', label: 'All Documents', icon: 'all', count: documentCounts.all },
    { id: 'favorites', label: 'Favorites', icon: 'star', count: documentCounts.favorites },
    { id: 'tags', label: 'Tags', icon: 'tag', expandable: true },
    { id: 'today', label: 'Today', icon: 'calendar' },
    { id: 'zen', label: 'Zen Captures', icon: 'zen' },
    { id: 'quote', label: 'Quote Captures', icon: 'quote' },
    { id: 'trash', label: 'Trash', icon: 'trash', count: documentCounts.trash },
  ];

  return (
    <div className="w-64 bg-surface/40 border-r border-muted/20 flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-muted/20 flex items-center justify-between px-4">
        <h1 className="text-lg font-medium text-foam">Library</h1>
        <button
          onClick={onNewDocument}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface/60 text-iris"
          aria-label="New document"
        >
          +
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {views.map(view => (
          <div key={view.id}>
            <button
              className={`
                w-full px-3 py-2 flex items-center gap-3 rounded-lg transition-colors
                ${currentView === view.id ? 'bg-iris/10 text-iris' : 'hover:bg-surface/60 text-text'}
              `}
              onClick={() => {
                onViewChange(view.id);
                if (view.id !== 'tags') {
                  onTagSelect(null);
                }
              }}
            >
              <span className="text-base opacity-60" aria-hidden="true">
                {view.icon === 'star' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                )}
                {view.icon === 'all' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v16H4z"/></svg>
                )}
                {view.icon === 'tag' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 10l-8-8H4v8l8 8 8-8zM7 7a1 1 0 110-2 1 1 0 010 2z"/></svg>
                )}
                {view.icon === 'calendar' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h2v2h6V2h2v2h2v16H3V4h2V2h2v2zM5 8v10h14V8H5z"/></svg>
                )}
                {view.icon === 'zen' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="3"/><path d="M4 20c1.5-3 4.5-5 8-5s6.5 2 8 5"/></svg>
                )}
                {view.icon === 'quote' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h7v6H9l-2 4H5l2-4H4V7h3zm9 0h7v6h-5l-2 4h-2l2-4h-2V7h2z"/></svg>
                )}
                {view.icon === 'trash' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h18v2H3zM8 9h2v9H8zm6 0h2v9h-2zM9 4h6v2H9z"/></svg>
                )}
              </span>
              <span className="flex-1 text-left text-sm">{view.label}</span>
              {view.count !== undefined && (
                <span className="text-xs text-muted">{view.count}</span>
              )}
            </button>

            {/* Tags expansion */}
            {view.id === 'tags' && currentView === 'tags' && (
              <div className="ml-8 mt-1 space-y-0.5">
                {tags.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted">No tags yet</div>
                ) : (
                  tags.map(tag => (
                    <button
                      key={tag.id}
                      className={`
                        w-full px-3 py-1.5 flex items-center gap-2 rounded-lg transition-colors text-left
                        ${selectedTag === tag.id ? 'bg-iris/10 text-iris' : 'hover:bg-surface/60 text-text'}
                      `}
                      onClick={() => onTagSelect(tag.id!)}
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm">{tag.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-muted/20">
        <button
          onClick={onImportExport}
          className="w-full px-3 py-2 text-sm text-muted hover:text-text hover:bg-surface/60 rounded-lg transition-colors"
        >
          Import/Export
        </button>
      </div>
    </div>
  );
};
