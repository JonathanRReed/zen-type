// Import/Export component for library backup and restore
import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import { DocumentStore, TagStore } from '../db';

interface ImportExportProps {
  onClose: () => void;
  onImportComplete: () => void;
}

export const ImportExport: React.FC<ImportExportProps> = ({ onClose, onImportComplete }) => {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export library as ZIP
  const handleExportLibrary = async () => {
    setExporting(true);
    setProgress('Preparing export...');

    try {
      const zip = new JSZip();
      
      // Get all documents
      const documents = await DocumentStore.getAll({ trashed: false });
      const tags = await TagStore.getAll();
      
      // Create manifest
      const manifest = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        documentCount: documents.length,
        tagCount: tags.length
      };
      
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      
      // Add documents
      const docsFolder = zip.folder('documents');
      for (const doc of documents) {
        if (!doc.id) continue;
        
        // Save as markdown with frontmatter
        const frontmatter = `---
title: ${doc.title}
created: ${doc.createdAt}
updated: ${doc.updatedAt}
favorite: ${doc.favorite}
tags: ${(await TagStore.getDocumentTags(doc.id)).map(t => t.name).join(', ')}
---

`;
        const content = frontmatter + doc.content;
        docsFolder?.file(`${doc.title.replace(/[^a-z0-9]/gi, '_')}.md`, content);
      }
      
      // Add tags
      zip.file('tags.json', JSON.stringify(tags, null, 2));
      
      // Generate ZIP
      setProgress('Generating archive...');
      const blob = await zip.generateAsync({ type: 'blob' });
      
      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zen-typer-library-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      
      setProgress('Export complete!');
      setTimeout(() => {
        setExporting(false);
        setProgress('');
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
      setProgress('Export failed');
      setExporting(false);
    }
  };

  // Import from ZIP
  const handleImportZip = async (file: File) => {
    setImporting(true);
    setProgress('Reading archive...');

    try {
      const zip = await JSZip.loadAsync(file);
      
      // Check manifest
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) {
        throw new Error('Invalid archive: missing manifest');
      }
      
      const manifest = JSON.parse(await manifestFile.async('string'));
      setProgress(`Found ${manifest.documentCount} documents`);
      
      // Import tags first
      const tagsFile = zip.file('tags.json');
      if (tagsFile) {
        const tags = JSON.parse(await tagsFile.async('string'));
        for (const tag of tags) {
          await TagStore.create(tag.name, tag.color);
        }
      }
      
      // Import documents
      const docsFolder = zip.folder('documents');
      if (docsFolder) {
        const files = Object.keys(docsFolder.files).filter(name => name.endsWith('.md'));
        
        for (let i = 0; i < files.length; i++) {
          const fileName = files[i];
          const file = zip.file(fileName);
          if (!file) continue;
          
          setProgress(`Importing ${i + 1}/${files.length}...`);
          
          const content = await file.async('string');
          
          // Parse frontmatter
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
          let title = 'Imported Document';
          let markdownContent = content;
          
          if (frontmatterMatch) {
            const frontmatter = frontmatterMatch[1];
            const titleMatch = frontmatter.match(/title: (.+)/);
            if (titleMatch) title = titleMatch[1];
            markdownContent = content.substring(frontmatterMatch[0].length);
          }
          
          await DocumentStore.create({
            title,
            content: markdownContent
          });
        }
      }
      
      setProgress('Import complete!');
      setTimeout(() => {
        onImportComplete();
      }, 1000);
    } catch (error) {
      console.error('Import failed:', error);
      setProgress('Import failed');
      setImporting(false);
    }
  };

  // Import markdown file
  const handleImportMarkdown = async (file: File) => {
    setImporting(true);
    setProgress('Reading file...');

    try {
      const content = await file.text();
      const title = file.name.replace(/\.md$/i, '');
      
      await DocumentStore.create({
        title,
        content
      });
      
      setProgress('Import complete!');
      setTimeout(() => {
        onImportComplete();
      }, 1000);
    } catch (error) {
      console.error('Import failed:', error);
      setProgress('Import failed');
      setImporting(false);
    }
  };

  // Import JSON file
  const handleImportJSON = async (file: File) => {
    setImporting(true);
    setProgress('Reading file...');

    try {
      const content = await file.text();
      const data = JSON.parse(content);
      
      if (Array.isArray(data)) {
        // Multiple documents
        for (let i = 0; i < data.length; i++) {
          setProgress(`Importing ${i + 1}/${data.length}...`);
          await DocumentStore.create(data[i]);
        }
      } else if (data.title && data.content) {
        // Single document
        await DocumentStore.create(data);
      } else {
        throw new Error('Invalid JSON format');
      }
      
      setProgress('Import complete!');
      setTimeout(() => {
        onImportComplete();
      }, 1000);
    } catch (error) {
      console.error('Import failed:', error);
      setProgress('Import failed');
      setImporting(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'zip':
        handleImportZip(file);
        break;
      case 'md':
      case 'markdown':
        handleImportMarkdown(file);
        break;
      case 'json':
        handleImportJSON(file);
        break;
      default:
        alert('Unsupported file type. Please use .zip, .md, or .json files.');
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-base/80 backdrop-blur-sm flex items-center justify-center">
      <div className="glass rounded-xl p-8 w-full max-w-md mx-4">
        <h2 className="text-xl font-medium text-text mb-6">Import / Export</h2>

        {/* Export Section */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-foam mb-3">Export Library</h3>
          <p className="text-sm text-muted mb-4">
            Download your entire library as a ZIP archive containing all documents and tags.
          </p>
          <button
            onClick={handleExportLibrary}
            disabled={exporting}
            className="w-full px-4 py-2 bg-iris/20 border border-iris/40 text-iris rounded-lg hover:bg-iris/30 transition-colors disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export Library (.zip)'}
          </button>
        </div>

        {/* Import Section */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-foam mb-3">Import Documents</h3>
          <p className="text-sm text-muted mb-4">
            Import documents from ZIP archives, Markdown files, or JSON files.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.md,.markdown,.json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="w-full px-4 py-2 bg-surface/60 border border-muted/20 rounded-lg hover:bg-surface/80 transition-colors disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Choose File...'}
          </button>
        </div>

        {/* Progress */}
        {progress && (
          <div className="mb-6 px-3 py-2 bg-surface/40 rounded-lg text-sm text-muted">
            {progress}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            disabled={importing || exporting}
            className="px-4 py-2 text-muted hover:text-text transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
