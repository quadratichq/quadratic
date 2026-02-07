//! Singleton that manages per-file view state persistence in IndexedDB.
//! Supports "Restore sheet when reopening files": saves and restores
//! selection and viewport per file.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Dexie } from 'dexie';

// ---------------------------------------------------------------------------
// Types (serializable state persisted in IndexedDB)
// ---------------------------------------------------------------------------

export interface FileViewStateViewport {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

export interface FileViewStateSheet {
  /** Serialized A1Selection (cursor position + selected ranges). From sheet.cursor.save(). */
  selection: string;
  viewport?: FileViewStateViewport;
}

export interface FileViewStateData {
  sheets: Record<string, FileViewStateSheet>;
  sheetId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DB_NAME = 'Quadratic-FileViewState';
const DB_VERSION = 1;
const DB_STORE = 'fileViewState';
const SETTINGS_KEY = 'viewSettings';
const DEBOUNCE_MS = 400;

interface FileViewStateEntry {
  fileUuid: string;
  state: FileViewStateData;
}

/** Read restoreFileViewState from localStorage (works outside React). */
function isRestoreEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const settings = JSON.parse(raw);
      return settings.restoreFileViewState === true;
    }
  } catch {
    // ignore
  }
  return false;
}

// ---------------------------------------------------------------------------
// Singleton class
// ---------------------------------------------------------------------------

class FileViewState {
  private db: Dexie;
  private dbReady: Promise<void>;
  private fileUuid?: string;
  private loaded?: FileViewStateData | null;
  private saveTimeout?: ReturnType<typeof setTimeout>;
  private listening = false;

  constructor() {
    this.db = new Dexie(DB_NAME);
    this.db.version(DB_VERSION).stores({
      [DB_STORE]: 'fileUuid',
    });
    this.dbReady = this.db.open().then(() => undefined);
  }

  // ---- Init (call in route loader, await before render) -------------------

  /**
   * Pre-fetches the saved view state for a file from IndexedDB.
   * Safe to call from the route loader before React renders.
   * Must be called with the file UUID; the result is cached until `destroy()`.
   */
  async init(fileUuid: string): Promise<void> {
    this.fileUuid = fileUuid;
    if (!isRestoreEnabled()) {
      this.loaded = null;
      return;
    }
    try {
      await this.dbReady;
      const table = this.db.table<FileViewStateEntry, string>(DB_STORE);
      const entry = await table.get(fileUuid);
      this.loaded = entry?.state ?? null;
    } catch (e) {
      console.warn('[fileViewState] Failed to load from IndexedDB:', e);
      this.loaded = null;
    }
  }

  /** Whether we have saved state that can be applied. */
  get hasState(): boolean {
    return this.loaded != null;
  }

  /** The loaded state (null if none or not yet loaded). */
  get state(): FileViewStateData | null {
    return this.loaded ?? null;
  }

  // ---- Apply: viewport + selection (call before first render) -------------

  /**
   * Applies viewport, selection, and current sheet from the loaded state.
   * Call after sheets are created but BEFORE the first pixi render so
   * the user never sees the default viewport.
   */
  applyViewportState(): void {
    const state = this.loaded;
    if (!state) return;
    try {
      for (const sheetId of Object.keys(state.sheets)) {
        const sheet = sheets.getById(sheetId);
        if (!sheet) continue;
        const { selection, viewport } = state.sheets[sheetId];
        sheet.cursor.load(selection);
        sheet.cursor.checkForTableRef();
        if (viewport) {
          sheet.cursor.viewport = viewport;
        }
      }
      if (state.sheetId && sheets.getById(state.sheetId)) {
        sheets.current = state.sheetId;
      }
      pixiApp.viewport.loadViewport();
      pixiApp.setViewportDirty();
      events.emit('cursorPosition');
    } catch (e) {
      console.warn('[fileViewState] Failed to apply viewport state:', e);
    }
  }

  // ---- Save (debounced, driven by events) ---------------------------------

  /**
   * Starts listening to events and saving state to IndexedDB (debounced).
   * Call from a React effect when the setting is on.
   */
  startSaving(): void {
    if (this.listening || !this.fileUuid || !isRestoreEnabled()) return;
    this.listening = true;

    const save = () => {
      if (this.saveTimeout) clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => {
        this.saveTimeout = undefined;
        this.saveNow();
      }, DEBOUNCE_MS);
    };

    events.on('cursorPosition', save);
    events.on('changeSheet', save);
    events.on('viewportChangedReady', save);
  }

  /** Force an immediate save (e.g. before navigating away). */
  saveNow(): void {
    if (!this.fileUuid) return;
    try {
      const stateSheets: Record<string, FileViewStateSheet> = {};
      for (const sheet of sheets.sheets) {
        stateSheets[sheet.id] = {
          selection: sheet.cursor.save(),
          viewport: sheet.cursor.viewport,
        };
      }
      const data: FileViewStateData = {
        sheets: stateSheets,
        sheetId: sheets.current,
      };
      this.dbReady.then(() => {
        const table = this.db.table<FileViewStateEntry, string>(DB_STORE);
        table.put({ fileUuid: this.fileUuid!, state: data });
      });
    } catch (e) {
      console.warn('[fileViewState] Failed to save state:', e);
    }
  }

  // ---- Cleanup ------------------------------------------------------------

  /**
   * Stop saving and clear cached state. Call when leaving the file route.
   */
  destroy(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    events.off('cursorPosition');
    events.off('changeSheet');
    events.off('viewportChangedReady');
    this.listening = false;
    this.loaded = undefined;
    this.fileUuid = undefined;
  }
}

export const fileViewState = new FileViewState();
