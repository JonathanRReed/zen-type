// Integration component for Zen Mode -> Library handoff
import React, { useEffect } from 'react';
import { SessionStore } from './db';

interface ZenModeIntegrationProps {
  sessionData?: {
    type: 'zen' | 'quote';
    startedAt: Date;
    endedAt?: Date;
    text: string;
    wordCount: number;
    charCount?: number;
    quote?: string;
    author?: string;
  };
  onSessionSaved?: (sessionId: string) => void;
}

export const ZenModeIntegration: React.FC<ZenModeIntegrationProps> = ({
  sessionData,
  onSessionSaved
}) => {
  useEffect(() => {
    if (!sessionData) return;
    
    const saveSession = async () => {
      try {
        const sessionId = await SessionStore.create(sessionData);
        onSessionSaved?.(sessionId);
      } catch (error) {
        console.error('Failed to save session:', error);
      }
    };
    
    saveSession();
  }, [sessionData, onSessionSaved]);
  
  return null;
};

// Helper function to trigger Library opening with session conversion
export const openLibraryWithSession = (sessionId: string) => {
  window.dispatchEvent(new CustomEvent('toggleArchive', {
    detail: { sessionId }
  }));
};

// Helper function for Zen mode to save and open session
export const saveZenSessionAndOpenLibrary = async (
  text: string,
  startedAt: Date,
  endedAt: Date,
  wordCount: number,
  charCount: number
) => {
  try {
    const sessionId = await SessionStore.create({
      type: 'zen',
      startedAt,
      endedAt,
      text,
      wordCount,
      charCount
    });
    
    openLibraryWithSession(sessionId);
  } catch (error) {
    console.error('Failed to save Zen session:', error);
  }
};

// Helper function for Quote mode to save and open session
export const saveQuoteSessionAndOpenLibrary = async (
  text: string,
  quote: string,
  author: string,
  startedAt: Date,
  endedAt: Date,
  wordCount: number,
  charCount: number
) => {
  try {
    const sessionId = await SessionStore.create({
      type: 'quote',
      startedAt,
      endedAt,
      text,
      wordCount,
      charCount,
      quote,
      author
    });
    
    openLibraryWithSession(sessionId);
  } catch (error) {
    console.error('Failed to save Quote session:', error);
  }
};
