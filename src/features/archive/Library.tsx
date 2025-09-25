// Main Library component with sidebar, document list, and editor
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { DocumentStore, TagStore, SessionStore, db, type Document, type Tag, migrateFromLocalStorage } from './db';
import { EditorCore } from './editor/EditorCore';
import { DocumentList } from './components/DocumentList';
import { Sidebar } from './components/Sidebar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { RevisionsPanel } from './components/RevisionsPanel';
import { ImportExport } from './components/ImportExport';
import { SearchBar } from './components/SearchBar';
import Fuse from 'fuse.js';
import { debounce } from '../../utils/debounce';

type View = 'all' | 'favorites' | 'tags' | 'today' | 'zen' | 'quote' | 'trash';

interface LibraryProps {
  isOpen: boolean;
  onClose: () => void;
  initialSessionId?: string; // For Zen/Quote mode handoff
}

export const Library: React.FC<LibraryProps> = ({ isOpen, onClose, initialSessionId }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [typewriterMode, setTypewriterMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated');

  // Initialize database and migrate data
  useEffect(() => {
    const init = async () => {
      try {
        // Check if we need to migrate
        const migrated = localStorage.getItem('zt.migrated');
        if (!migrated) {
          await migrateFromLocalStorage();
        }

        // Load initial data
        await loadDocuments();
        await loadTags();

        // Handle initial session if provided
        if (initialSessionId) {
          const docId = await SessionStore.convertToDocument(initialSessionId);
          setSelectedDocId(docId);
          setShowEditor(true);
        }

        setLoading(false);
      } catch (error) {
        console.error('Library initialization failed:', error);
        setLoading(false);
      }
    };

    if (isOpen) {
      init();
    }
  }, [isOpen, initialSessionId]);

  // Load documents based on current view and filters
  const loadDocuments = async () => {
    let docs: Document[] = [];
    
    switch (currentView) {
      case 'all':
        docs = await DocumentStore.getAll({ trashed: false });
        break;
      case 'favorites':
        docs = await DocumentStore.getAll({ trashed: false, favorite: true });
        break;
      case 'tags':
        if (selectedTag) {
          docs = await DocumentStore.getAll({ trashed: false, tag: selectedTag });
        }
        break;
      case 'today':
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        docs = await DocumentStore.getAll({ trashed: false });
        docs = docs.filter(d => new Date(d.updatedAt) >= today);
        break;
      case 'zen':
      case 'quote':
        const sessions = await db.sessions.where('type').equals(currentView).toArray();
        const sessionIds = sessions.map(s => s.id);
        docs = await DocumentStore.getAll({ trashed: false });
        docs = docs.filter(d => d.sourceSessionId && sessionIds.includes(d.sourceSessionId));
        break;
      case 'trash':
        docs = await DocumentStore.getAll({ trashed: true });
        break;
    }
    
    setDocuments(docs);
  };

  // Load tags
  const loadTags = async () => {
    const allTags = await TagStore.getAll();
    setTags(allTags);
  };

  // Reload when view changes
  useEffect(() => {
    if (!loading) {
      loadDocuments();
    }
  }, [currentView, selectedTag]);

  // Fuzzy search
  const searchResults = useMemo(() => {
    if (!searchQuery) return documents;
    
    const fuse = new Fuse(documents, {
      keys: ['title', 'content'],
      threshold: 0.3,
      includeScore: true
    });
    
    return fuse.search(searchQuery).map(result => result.item);
  }, [documents, searchQuery]);

  // Sorted documents
  const sortedDocuments = useMemo(() => {
    const docs = [...searchResults];
    
    switch (sortBy) {
      case 'updated':
        return docs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      case 'created':
        return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'title':
        return docs.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return docs;
    }
  }, [searchResults, sortBy]);

  // Selected document
  const selectedDocument = useMemo(() => {
    return documents.find(d => d.id === selectedDocId) || null;
  }, [documents, selectedDocId]);

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      setSearchQuery(query);
    }, 300),
    []
  );

  // Handle document selection
  const handleSelectDocument = (docId: string) => {
    setSelectedDocId(docId);
    setShowEditor(true);
    setShowRevisions(false);
  };

  // Handle new document
  const handleNewDocument = async () => {
    const docId = await DocumentStore.create({
      title: 'Untitled',
      content: ''
    });
    await loadDocuments();
    setSelectedDocId(docId);
    setShowEditor(true);
  };

  // Handle document update
  const handleDocumentUpdate = useCallback(async (content: string) => {
    if (!selectedDocId) return;
    
    await DocumentStore.update(selectedDocId, { content });
    await loadDocuments();
  }, [selectedDocId]);

  // Handle document deletion
  const handleDeleteDocument = async (docId: string) => {
    if (currentView === 'trash') {
      // Permanent delete
      if (confirm('Permanently delete this document? This cannot be undone.')) {
        await DocumentStore.delete(docId);
      }
    } else {
      // Move to trash
      await DocumentStore.trash(docId);
    }
    
    await loadDocuments();
    
    if (docId === selectedDocId) {
      setSelectedDocId(null);
      setShowEditor(false);
    }
  };

  // Handle document restoration
  const handleRestoreDocument = async (docId: string) => {
    await DocumentStore.restore(docId);
    await loadDocuments();
    setCurrentView('all');
  };

  // Handle favorite toggle
  const handleToggleFavorite = async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (doc) {
      await DocumentStore.update(docId, { favorite: !doc.favorite });
      await loadDocuments();
    }
  };

  // Handle tag management
  const handleAddTag = async (docId: string, tagId: string) => {
    await TagStore.addToDocument(docId, tagId);
  };

  const handleRemoveTag = async (docId: string, tagId: string) => {
    await TagStore.removeFromDocument(docId, tagId);
  };

  const handleCreateTag = async (name: string, color: string) => {
    await TagStore.create(name, color);
    await loadTags();
  };

  // Handle export
  const handleExportLibrary = async () => {
    setShowImportExport(true);
  };

  // Handle empty trash
  const handleEmptyTrash = async () => {
    if (confirm('Empty trash? All documents will be permanently deleted.')) {
      const trashedDocs = await DocumentStore.getAll({ trashed: true });
      for (const doc of trashedDocs) {
        if (doc.id) await DocumentStore.delete(doc.id);
      }
      await loadDocuments();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="library fixed inset-0 z-50 bg-base flex">
      {/* Left Sidebar */}
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        tags={tags}
        selectedTag={selectedTag}
        onTagSelect={setSelectedTag}
        onNewDocument={handleNewDocument}
        onImportExport={() => setShowImportExport(true)}
        documentCounts={{
          all: documents.filter(d => !d.trashed).length,
          favorites: documents.filter(d => !d.trashed && d.favorite).length,
          trash: documents.filter(d => d.trashed).length
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-muted/20 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-medium text-text">
              {currentView === 'tags' && selectedTag 
                ? tags.find(t => t.id === selectedTag)?.name 
                : currentView.charAt(0).toUpperCase() + currentView.slice(1)}
            </h2>
            <SearchBar 
              value={searchQuery}
              onChange={debouncedSearch}
              placeholder="Search documents..."
            />
          </div>
          
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 bg-surface/60 border border-muted/20 rounded-lg text-sm"
            >
              <option value="updated">Last Updated</option>
              <option value="created">Created Date</option>
              <option value="title">Title</option>
            </select>
            
            {currentView === 'trash' && documents.filter(d => d.trashed).length > 0 && (
              <button
                onClick={handleEmptyTrash}
                className="px-3 py-1.5 bg-love/20 border border-love/40 text-love rounded-lg text-sm hover:bg-love/30"
              >
                Empty Trash
              </button>
            )}
            
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-surface/60 border border-muted/20 rounded-lg text-sm hover:bg-surface/80"
            >
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Document List */}
          {!showEditor && (
            <div className="flex-1 overflow-y-auto">
              <DocumentList
                documents={sortedDocuments}
                selectedDocId={selectedDocId}
                onSelect={handleSelectDocument}
                onDelete={handleDeleteDocument}
                onRestore={currentView === 'trash' ? handleRestoreDocument : undefined}
                onToggleFavorite={handleToggleFavorite}
              />
            </div>
          )}

          {/* Editor */}
          {showEditor && selectedDocument && (
            <div className="flex-1 flex">
              <div className="flex-1 overflow-y-auto">
                <EditorCore
                  document={selectedDocument}
                  onUpdate={handleDocumentUpdate}
                  focusMode={focusMode}
                  typewriterMode={typewriterMode}
                  className="p-8 max-w-4xl mx-auto"
                />
              </div>

              {/* Properties Panel */}
              <PropertiesPanel
                document={selectedDocument}
                tags={tags}
                onUpdateDocument={async (updates) => {
                  await DocumentStore.update(selectedDocId!, updates);
                  await loadDocuments();
                }}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                onShowRevisions={() => setShowRevisions(true)}
                onToggleFocusMode={() => setFocusMode(!focusMode)}
                onToggleTypewriter={() => setTypewriterMode(!typewriterMode)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Revisions Panel */}
      {showRevisions && selectedDocId && (
        <RevisionsPanel
          documentId={selectedDocId}
          onClose={() => setShowRevisions(false)}
          onRestore={async () => {
            await loadDocuments();
            setShowRevisions(false);
          }}
        />
      )}

      {/* Import/Export Modal */}
      {showImportExport && (
        <ImportExport
          onClose={() => setShowImportExport(false)}
          onImportComplete={async () => {
            await loadDocuments();
            setShowImportExport(false);
          }}
        />
      )}
    </div>
  );
};

export default Library;
