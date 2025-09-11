/**
 * Client-side storage for AI-generated code cell summaries
 * This stores summaries in memory and optionally persists them to localStorage
 */

import { events } from '@/app/events/events';
import type { JsUpdateCodeCell } from '@/app/quadratic-core-types';

interface CodeCellSummary {
  sheetId: string;
  x: number;
  y: number;
  summary: string;
  codeString: string; // Store code string to detect changes
  timestamp: number;
}

class AICodeCellSummaryStore {
  private summaries = new Map<string, CodeCellSummary>();
  private readonly STORAGE_KEY = 'quadratic_ai_code_cell_summaries';
  private readonly MAX_SUMMARIES = 1000; // Limit to prevent memory issues
  private saveTimeoutId: NodeJS.Timeout | null = null;
  private readonly SAVE_DEBOUNCE_MS = 500; // Debounce localStorage writes by 500ms

  constructor() {
    this.loadFromStorage();

    // Listen for code cell updates to clean up deleted cells
    events.on('updateCodeCells', this.handleCodeCellUpdates);

    // Ensure data is saved before page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushToStorage();
      });
    }
  }

  private getKey(sheetId: string, x: number, y: number): string {
    return `${sheetId}:${x}:${y}`;
  }

  /**
   * Handle code cell updates to clean up AI summaries for deleted cells
   */
  private handleCodeCellUpdates = (updateCodeCells: JsUpdateCodeCell[]): void => {
    let hasChanges = false;

    for (const update of updateCodeCells) {
      // If render_code_cell is null, the code cell was deleted
      if (!update.render_code_cell) {
        const sheetId = update.sheet_id.id;
        const x = Number(update.pos.x);
        const y = Number(update.pos.y);
        const key = this.getKey(sheetId, x, y);

        if (this.summaries.has(key)) {
          console.log('[aiCodeCellSummaryStore] Cleaning up AI summary for deleted code cell:', key);
          this.summaries.delete(key);
          hasChanges = true;
        }
      }
    }

    // Only trigger save if we actually removed summaries
    if (hasChanges) {
      this.debouncedSaveToStorage();
    }
  };

  /**
   * Store a summary for an AI-generated code cell
   */
  setSummary(sheetId: string, x: number, y: number, summary: string, codeString: string): void {
    const key = this.getKey(sheetId, x, y);
    console.log('[aiCodeCellSummaryStore] Storing summary for key:', key, 'summary:', summary);

    this.summaries.set(key, {
      sheetId,
      x,
      y,
      summary,
      codeString,
      timestamp: Date.now(),
    });

    // Limit the number of stored summaries
    if (this.summaries.size > this.MAX_SUMMARIES) {
      this.cleanupOldSummaries();
    }

    this.debouncedSaveToStorage();
    console.log('[aiCodeCellSummaryStore] Total summaries stored:', this.summaries.size);
  }

  /**
   * Get a summary for a code cell
   * Returns null if no summary exists or if the code has changed
   */
  getSummary(sheetId: string, x: number, y: number, currentCodeString?: string): string | null {
    const key = this.getKey(sheetId, x, y);
    const summary = this.summaries.get(key);
    console.log('[aiCodeCellSummaryStore] Getting summary for key:', key, 'found:', !!summary);

    if (!summary) {
      console.log('[aiCodeCellSummaryStore] No summary found for key:', key);
      return null;
    }

    // If code has changed, remove the outdated summary
    if (currentCodeString && summary.codeString !== currentCodeString) {
      console.log('[aiCodeCellSummaryStore] Code changed, removing outdated summary for key:', key);
      this.summaries.delete(key);
      this.debouncedSaveToStorage();
      return null;
    }

    console.log('[aiCodeCellSummaryStore] Returning summary for key:', key, 'summary:', summary.summary);
    return summary.summary;
  }

  /**
   * Check if a code cell has an AI summary
   */
  hasSummary(sheetId: string, x: number, y: number): boolean {
    const key = this.getKey(sheetId, x, y);
    return this.summaries.has(key);
  }

  /**
   * Remove a summary for a code cell
   */
  removeSummary(sheetId: string, x: number, y: number): void {
    const key = this.getKey(sheetId, x, y);
    this.summaries.delete(key);
    this.debouncedSaveToStorage();
  }

  /**
   * Clear all summaries for a sheet
   */
  clearSheet(sheetId: string): void {
    for (const [key, summary] of this.summaries.entries()) {
      if (summary.sheetId === sheetId) {
        this.summaries.delete(key);
      }
    }
    this.debouncedSaveToStorage();
  }

  /**
   * Clean up old summaries to prevent memory issues
   */
  private cleanupOldSummaries(): void {
    const entries = Array.from(this.summaries.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest 20% of summaries
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.summaries.delete(entries[i][0]);
    }
  }

  /**
   * Debounced save to localStorage to prevent excessive writes
   */
  private debouncedSaveToStorage(): void {
    // Clear existing timeout
    if (this.saveTimeoutId) {
      clearTimeout(this.saveTimeoutId);
    }

    // Set new timeout
    this.saveTimeoutId = setTimeout(() => {
      this.saveToStorage();
      this.saveTimeoutId = null;
    }, this.SAVE_DEBOUNCE_MS);
  }

  /**
   * Force immediate save to localStorage (used for critical operations)
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.summaries.entries());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      console.log('[aiCodeCellSummaryStore] Saved summaries to localStorage');
    } catch (error) {
      console.warn('Failed to save AI code cell summaries to localStorage:', error);
      // If localStorage is full, try to clear some space
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.handleStorageQuotaExceeded();
      }
    }
  }

  /**
   * Handle localStorage quota exceeded by cleaning up old summaries
   */
  private handleStorageQuotaExceeded(): void {
    console.warn('[aiCodeCellSummaryStore] localStorage quota exceeded, cleaning up old summaries');

    // Remove 50% of summaries to free up space
    const entries = Array.from(this.summaries.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = Math.floor(entries.length * 0.5);
    for (let i = 0; i < toRemove; i++) {
      this.summaries.delete(entries[i][0]);
    }

    // Try saving again
    try {
      const data = Array.from(this.summaries.entries());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      console.log('[aiCodeCellSummaryStore] Successfully saved after cleanup');
    } catch (retryError) {
      console.error('[aiCodeCellSummaryStore] Failed to save even after cleanup:', retryError);
    }
  }

  /**
   * Load summaries from localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const entries: [string, CodeCellSummary][] = JSON.parse(data);
        this.summaries = new Map(entries);
      }
    } catch (error) {
      console.warn('Failed to load AI code cell summaries from localStorage:', error);
      this.summaries.clear();
    }
  }

  /**
   * Force immediate save (useful for critical operations or before page unload)
   */
  public flushToStorage(): void {
    if (this.saveTimeoutId) {
      clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = null;
    }
    this.saveToStorage();
  }

  /**
   * Cleanup method to clear pending timeouts and event listeners
   */
  public destroy(): void {
    // Clean up event listener
    events.off('updateCodeCells', this.handleCodeCellUpdates);

    // Clear pending timeout
    if (this.saveTimeoutId) {
      clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = null;
    }

    // Force final save before destruction
    this.saveToStorage();
  }
}

// Export a singleton instance
export const aiCodeCellSummaryStore = new AICodeCellSummaryStore();
