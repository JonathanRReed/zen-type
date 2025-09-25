// Hook for session handoff from Zen/Quote modes to Library
import { useCallback } from 'react';
import { SessionStore } from '../db';
import { getArchiveEntry, type ArchiveEntry } from '../../../utils/storage';

export function useSessionHandoff() {
  // Convert legacy archive entry to new session and open Library
  const convertArchiveToLibrary = useCallback(async (archiveId: string) => {
    try {
      const archiveEntry = getArchiveEntry(archiveId);
      if (!archiveEntry) {
        console.error('Archive entry not found');
        return;
      }
      
      // Create session from archive entry
      const sessionId = await SessionStore.create({
        type: 'zen',
        startedAt: new Date(archiveEntry.startedAt),
        endedAt: archiveEntry.endedAt ? new Date(archiveEntry.endedAt) : undefined,
        text: archiveEntry.text,
        wordCount: archiveEntry.wordCount,
        charCount: archiveEntry.charCount
      });
      
      // Open Library with session to convert to document
      window.dispatchEvent(new CustomEvent('toggleArchive', {
        detail: { sessionId }
      }));
      
      return sessionId;
    } catch (error) {
      console.error('Failed to convert archive entry:', error);
    }
  }, []);
  
  // Save session and open in Library
  const saveAndOpenSession = useCallback(async (
    type: 'zen' | 'quote',
    data: {
      text: string;
      startedAt: Date;
      endedAt?: Date;
      wordCount: number;
      charCount?: number;
      quote?: string;
      author?: string;
    }
  ) => {
    try {
      const sessionId = await SessionStore.create({
        type,
        ...data
      });
      
      // Open Library with session
      window.dispatchEvent(new CustomEvent('toggleArchive', {
        detail: { sessionId }
      }));
      
      return sessionId;
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }, []);
  
  // Just open Library without session
  const openLibrary = useCallback(() => {
    window.dispatchEvent(new CustomEvent('toggleArchive', { detail: true }));
  }, []);
  
  return {
    convertArchiveToLibrary,
    saveAndOpenSession,
    openLibrary
  };
}
