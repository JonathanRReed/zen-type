// IndexedDB storage layer using Dexie for the Archive/Editor system
import Dexie, { Table } from 'dexie';
import { diffChars } from 'diff';

// Database interfaces
export interface Document {
  id?: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  wordCount: number;
  charCount: number;
  favorite?: boolean;
  color?: string;
  trashed?: boolean;
  trashedAt?: Date;
  lastSnapshotAt?: Date;
  sourceSessionId?: string; // Link to zen/quote session
}

export interface Revision {
  id?: string;
  docId: string;
  timestamp: Date;
  type: 'snapshot' | 'diff';
  content: string; // Full text for snapshot, diff string for diff
  summary?: string;
  wordCount?: number;
  charCount?: number;
}

export interface Tag {
  id?: string;
  name: string;
  color: string;
}

export interface DocTag {
  docId: string;
  tagId: string;
}

export interface Session {
  id?: string;
  type: 'zen' | 'quote';
  startedAt: Date;
  endedAt?: Date;
  text: string;
  wordCount: number;
  charCount?: number;
  quote?: string;
  author?: string;
}

export interface SearchIndex {
  docId: string;
  title: string;
  content: string;
  updatedAt: Date;
}

// Database configuration
class ZenTyperDatabase extends Dexie {
  documents!: Table<Document>;
  revisions!: Table<Revision>;
  tags!: Table<Tag>;
  docTags!: Table<DocTag>;
  sessions!: Table<Session>;
  searchIndex!: Table<SearchIndex>;

  constructor() {
    super('zenTyper');
    
    this.version(1).stores({
      documents: '++id, title, createdAt, updatedAt, favorite, trashed, sourceSessionId',
      revisions: '++id, docId, timestamp, type',
      tags: '++id, name',
      docTags: '[docId+tagId], docId, tagId',
      sessions: '++id, type, startedAt, endedAt',
      searchIndex: 'docId, updatedAt'
    });
  }
}

export const db = new ZenTyperDatabase();

// Document operations
export class DocumentStore {
  static async create(data: Partial<Document>): Promise<string> {
    const now = new Date();
    const text = data.content || '';
    const doc: Document = {
      title: data.title || 'Untitled',
      content: text,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      wordCount: this.countWords(text),
      charCount: text.length,
      favorite: data.favorite || false,
      color: data.color,
      trashed: false,
      lastSnapshotAt: now,
      sourceSessionId: data.sourceSessionId,
    };
    
    const id = await db.documents.add(doc);
    
    // Create initial snapshot
    await RevisionStore.createSnapshot(String(id), text);
    
    // Update search index
    await SearchIndexStore.update(String(id), doc.title, text, now);
    
    return String(id);
  }

  static async update(id: string, data: Partial<Document>, createRevision = true): Promise<void> {
    const doc = await db.documents.get(id);
    if (!doc) throw new Error('Document not found');
    
    const now = new Date();
    const updates: Partial<Document> = {
      ...data,
      updatedAt: now
    };
    
    if (data.content !== undefined && data.content !== doc.content) {
      updates.wordCount = this.countWords(data.content);
      updates.charCount = data.content.length;
      
      if (createRevision) {
        // Check if we should create a snapshot or diff
        const shouldSnapshot = await this.shouldCreateSnapshot(id, doc.lastSnapshotAt);
        
        if (shouldSnapshot) {
          await RevisionStore.createSnapshot(id, data.content);
          updates.lastSnapshotAt = now;
        } else {
          await RevisionStore.createDiff(id, doc.content, data.content);
        }
      }
      
      // Update search index
      await SearchIndexStore.update(id, data.title || doc.title, data.content, now);
    }
    
    await db.documents.update(id, updates);
  }

  static async get(id: string): Promise<Document | undefined> {
    return await db.documents.get(id);
  }

  static async getAll(filter?: {
    trashed?: boolean;
    favorite?: boolean;
    tag?: string;
    search?: string;
  }): Promise<Document[]> {
    let collection = db.documents.toCollection();
    
    if (filter?.trashed !== undefined) {
      collection = collection.filter(doc => doc.trashed === filter.trashed);
    }
    
    if (filter?.favorite !== undefined) {
      collection = collection.filter(doc => doc.favorite === filter.favorite);
    }
    
    if (filter?.tag) {
      const docIds = await db.docTags.where('tagId').equals(filter.tag).toArray();
      const ids = docIds.map(dt => dt.docId);
      collection = collection.filter(doc => doc.id && ids.includes(doc.id));
    }
    
    let docs = await collection.toArray();
    
    if (filter?.search) {
      // Use search index for filtering
      const searchResults = await SearchIndexStore.search(filter.search);
      const matchedIds = new Set(searchResults.map(r => r.docId));
      docs = docs.filter(d => d.id && matchedIds.has(d.id));
    }
    
    return docs;
  }

  static async trash(id: string): Promise<void> {
    await db.documents.update(id, {
      trashed: true,
      trashedAt: new Date()
    });
  }

  static async restore(id: string): Promise<void> {
    await db.documents.update(id, {
      trashed: false,
      trashedAt: undefined
    });
  }

  static async delete(id: string): Promise<void> {
    await db.transaction('rw', db.documents, db.revisions, db.docTags, db.searchIndex, async () => {
      await db.documents.delete(id);
      await db.revisions.where('docId').equals(id).delete();
      await db.docTags.where('docId').equals(id).delete();
      await db.searchIndex.where('docId').equals(id).delete();
    });
  }

  static async cleanTrash(daysOld = 30): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    
    const trashedDocs = await db.documents
      .filter(doc => doc.trashed && doc.trashedAt && doc.trashedAt < cutoff)
      .toArray();
    
    for (const doc of trashedDocs) {
      if (doc.id) await this.delete(doc.id);
    }
  }

  private static countWords(text: string): number {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  }

  private static async shouldCreateSnapshot(docId: string, lastSnapshotAt?: Date): Promise<boolean> {
    if (!lastSnapshotAt) return true;
    
    const minutesSinceSnapshot = (Date.now() - lastSnapshotAt.getTime()) / (1000 * 60);
    if (minutesSinceSnapshot >= 5) return true;
    
    const recentRevisions = await db.revisions
      .where('docId').equals(docId)
      .and(r => r.timestamp > lastSnapshotAt)
      .count();
    
    return recentRevisions >= 20;
  }
}

// Revision operations
export class RevisionStore {
  static async createSnapshot(docId: string, content: string): Promise<void> {
    await db.revisions.add({
      docId,
      timestamp: new Date(),
      type: 'snapshot',
      content,
      wordCount: DocumentStore['countWords'](content),
      charCount: content.length,
      summary: 'Full snapshot'
    });
  }

  static async createDiff(docId: string, oldContent: string, newContent: string): Promise<void> {
    const changes = diffChars(oldContent, newContent);
    const diffString = JSON.stringify(changes);
    
    await db.revisions.add({
      docId,
      timestamp: new Date(),
      type: 'diff',
      content: diffString,
      wordCount: DocumentStore['countWords'](newContent),
      charCount: newContent.length,
      summary: this.generateDiffSummary(changes)
    });
  }

  static async getRevisions(docId: string, limit?: number): Promise<Revision[]> {
    let query = db.revisions.where('docId').equals(docId);
    
    if (limit) {
      return await query.reverse().limit(limit).toArray();
    }
    
    return await query.reverse().toArray();
  }

  static async restoreRevision(docId: string, revisionId: string): Promise<void> {
    const revision = await db.revisions.get(revisionId);
    if (!revision || revision.docId !== docId) {
      throw new Error('Revision not found');
    }
    
    let content: string;
    
    if (revision.type === 'snapshot') {
      content = revision.content;
    } else {
      // Reconstruct from nearest snapshot and subsequent diffs
      content = await this.reconstructContent(docId, revision.timestamp);
    }
    
    await DocumentStore.update(docId, { content }, false);
  }

  private static async reconstructContent(docId: string, targetTime: Date): Promise<string> {
    // Find nearest snapshot before target time
    const snapshot = await db.revisions
      .where('docId').equals(docId)
      .and(r => r.type === 'snapshot' && r.timestamp <= targetTime)
      .reverse()
      .first();
    
    if (!snapshot) {
      throw new Error('No snapshot found');
    }
    
    let content = snapshot.content;
    
    // Apply diffs up to target time
    const diffs = await db.revisions
      .where('docId').equals(docId)
      .and(r => r.type === 'diff' && r.timestamp > snapshot.timestamp && r.timestamp <= targetTime)
      .toArray();
    
    for (const diff of diffs) {
      const changes = JSON.parse(diff.content);
      content = this.applyDiff(content, changes);
    }
    
    return content;
  }

  private static applyDiff(content: string, changes: any[]): string {
    let result = '';
    for (const change of changes) {
      if (change.added) {
        result += change.value;
      } else if (!change.removed) {
        result += change.value;
      }
    }
    return result;
  }

  private static generateDiffSummary(changes: any[]): string {
    let added = 0, removed = 0;
    for (const change of changes) {
      if (change.added) added += change.value.length;
      if (change.removed) removed += change.value.length;
    }
    return `+${added} -${removed} chars`;
  }
}

// Tag operations
export class TagStore {
  static async create(name: string, color: string): Promise<string> {
    const id = await db.tags.add({ name, color });
    return String(id);
  }

  static async update(id: string, updates: Partial<Tag>): Promise<void> {
    await db.tags.update(id, updates);
  }

  static async delete(id: string): Promise<void> {
    await db.transaction('rw', db.tags, db.docTags, async () => {
      await db.tags.delete(id);
      await db.docTags.where('tagId').equals(id).delete();
    });
  }

  static async getAll(): Promise<Tag[]> {
    return await db.tags.toArray();
  }

  static async addToDocument(docId: string, tagId: string): Promise<void> {
    await db.docTags.put({ docId, tagId });
  }

  static async removeFromDocument(docId: string, tagId: string): Promise<void> {
    await db.docTags.where({ docId, tagId }).delete();
  }

  static async getDocumentTags(docId: string): Promise<Tag[]> {
    const docTags = await db.docTags.where('docId').equals(docId).toArray();
    const tagIds = docTags.map(dt => dt.tagId);
    
    if (tagIds.length === 0) return [];
    
    return await db.tags.where('id').anyOf(tagIds).toArray();
  }
}

// Session operations
export class SessionStore {
  static async create(data: Partial<Session>): Promise<string> {
    const session: Session = {
      type: data.type || 'zen',
      startedAt: data.startedAt || new Date(),
      endedAt: data.endedAt,
      text: data.text || '',
      wordCount: data.wordCount || 0,
      charCount: data.charCount,
      quote: data.quote,
      author: data.author,
    };
    
    const id = await db.sessions.add(session);
    return String(id);
  }

  static async get(id: string): Promise<Session | undefined> {
    return await db.sessions.get(id);
  }

  static async getRecent(limit = 10): Promise<Session[]> {
    return await db.sessions
      .orderBy('startedAt')
      .reverse()
      .limit(limit)
      .toArray();
  }

  static async convertToDocument(sessionId: string): Promise<string> {
    const session = await this.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    const title = session.type === 'quote' && session.quote
      ? `Quote: ${session.quote.substring(0, 50)}...`
      : `${session.type === 'zen' ? 'Zen' : 'Quote'} Session ${new Date(session.startedAt).toLocaleDateString()}`;
    
    let content = session.text;
    
    if (session.type === 'quote' && session.quote) {
      content = `> ${session.quote}\n> — ${session.author || 'Unknown'}\n\n${content}`;
    }
    
    return await DocumentStore.create({
      title,
      content,
      createdAt: session.startedAt,
      sourceSessionId: sessionId
    });
  }
}

// Search index operations
export class SearchIndexStore {
  static async update(docId: string, title: string, content: string, updatedAt: Date): Promise<void> {
    await db.searchIndex.put({
      docId,
      title: title.toLowerCase(),
      content: content.toLowerCase().substring(0, 5000), // Limit indexed content
      updatedAt
    });
  }

  static async search(query: string): Promise<SearchIndex[]> {
    const q = query.toLowerCase();
    const results = await db.searchIndex
      .filter(idx => 
        idx.title.includes(q) || idx.content.includes(q)
      )
      .toArray();
    
    // Sort by relevance (title matches first, then by recency)
    results.sort((a, b) => {
      const aInTitle = a.title.includes(q);
      const bInTitle = b.title.includes(q);
      
      if (aInTitle && !bInTitle) return -1;
      if (!aInTitle && bInTitle) return 1;
      
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    
    return results;
  }

  static async rebuildIndex(): Promise<void> {
    await db.searchIndex.clear();
    
    const docs = await db.documents.toArray();
    for (const doc of docs) {
      if (doc.id && !doc.trashed) {
        await this.update(doc.id, doc.title, doc.content, doc.updatedAt);
      }
    }
  }
}

// Migration from localStorage
export async function migrateFromLocalStorage(): Promise<void> {
  try {
    const archiveKey = 'zt.archive';
    const archiveData = localStorage.getItem(archiveKey);
    
    if (!archiveData) return;
    
    const entries = JSON.parse(archiveData);
    
    for (const entry of entries) {
      // Create session from archive entry
      const sessionId = await SessionStore.create({
        type: 'zen',
        startedAt: new Date(entry.startedAt),
        endedAt: entry.endedAt ? new Date(entry.endedAt) : undefined,
        text: entry.text,
        wordCount: entry.wordCount,
        charCount: entry.charCount
      });
      
      // Create document from session
      await SessionStore.convertToDocument(sessionId);
    }
    
    // Mark as migrated
    localStorage.setItem('zt.migrated', 'true');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}
