import type { AIMultiplayerSession, AIMultiplayerEvent } from 'quadratic-shared/ai/multiplayerSession';
import type { Response } from 'express';

/**
 * In-memory store for AI multiplayer sessions.
 * In production, this should be backed by Redis or similar for horizontal scaling.
 */
export const aiMultiplayerSessions = new Map<string, AIMultiplayerSession>();

/**
 * Event subscribers for SSE connections.
 * Each session can have multiple subscribers (e.g., multiple browser tabs).
 */
export const sessionEventSubscribers = new Map<string, Set<Response>>();

/**
 * Subscribe to events for a session.
 */
export function subscribeToSession(sessionId: string, res: Response): void {
  if (!sessionEventSubscribers.has(sessionId)) {
    sessionEventSubscribers.set(sessionId, new Set());
  }
  sessionEventSubscribers.get(sessionId)!.add(res);

  // Clean up on connection close
  res.on('close', () => {
    unsubscribeFromSession(sessionId, res);
  });
}

/**
 * Unsubscribe from events for a session.
 */
export function unsubscribeFromSession(sessionId: string, res: Response): void {
  const subscribers = sessionEventSubscribers.get(sessionId);
  if (subscribers) {
    subscribers.delete(res);
    if (subscribers.size === 0) {
      sessionEventSubscribers.delete(sessionId);
    }
  }
}

/**
 * Broadcast an event to all subscribers of a session.
 */
export function broadcastSessionEvent(sessionId: string, event: AIMultiplayerEvent): void {
  const subscribers = sessionEventSubscribers.get(sessionId);
  if (subscribers) {
    const eventData = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of subscribers) {
      try {
        res.write(eventData);
      } catch (error) {
        console.error('[AIMultiplayerSession] Failed to send event to subscriber:', error);
        unsubscribeFromSession(sessionId, res);
      }
    }
  }
}

/**
 * Get a session by ID.
 */
export function getSession(sessionId: string): AIMultiplayerSession | undefined {
  return aiMultiplayerSessions.get(sessionId);
}

/**
 * Update a session.
 */
export function updateSession(session: AIMultiplayerSession): void {
  session.updatedAt = Date.now();
  aiMultiplayerSessions.set(session.id, session);
}

/**
 * Delete a session.
 */
export function deleteSession(sessionId: string): void {
  aiMultiplayerSessions.delete(sessionId);

  // Close all subscriber connections
  const subscribers = sessionEventSubscribers.get(sessionId);
  if (subscribers) {
    for (const res of subscribers) {
      try {
        res.end();
      } catch (error) {
        // Ignore errors when closing connections
      }
    }
    sessionEventSubscribers.delete(sessionId);
  }
}

/**
 * Clean up old sessions (e.g., sessions older than 24 hours).
 */
export function cleanupOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  const now = Date.now();
  for (const [sessionId, session] of aiMultiplayerSessions) {
    if (now - session.updatedAt > maxAgeMs) {
      deleteSession(sessionId);
    }
  }
}

// Run cleanup every hour
setInterval(() => cleanupOldSessions(), 60 * 60 * 1000);
