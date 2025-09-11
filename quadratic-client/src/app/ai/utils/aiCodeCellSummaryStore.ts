/**
 * Client-side storage for AI-generated code cell summaries
 * This stores summaries in memory and optionally persists them to localStorage
 */

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

  constructor() {
    this.loadFromStorage();
  }

  private getKey(sheetId: string, x: number, y: number): string {
    return `${sheetId}:${x}:${y}`;
  }

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

    this.saveToStorage();
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
      this.saveToStorage();
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
    this.saveToStorage();
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
    this.saveToStorage();
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
   * Save summaries to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.summaries.entries());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save AI code cell summaries to localStorage:', error);
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
}

// Export a singleton instance
export const aiCodeCellSummaryStore = new AICodeCellSummaryStore();
