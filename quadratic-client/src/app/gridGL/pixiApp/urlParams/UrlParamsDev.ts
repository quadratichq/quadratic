//! Dev-focused parameters enabled by `debugFlags.saveURLState = true;`

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { SheetCursorSave } from '@/app/grid/sheet/SheetCursor';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { IViewportTransformState } from 'pixi-viewport';

const URL_STATE_PARAM = 'state';
const WAIT_FOR_SET_EDITOR_INTERACTION_STATE_TIMEOUT_MS = 100;

interface SheetState {
  cursor: SheetCursorSave;
  viewport?: IViewportTransformState;
}

export interface UrlParamsDevState {
  sheets: Record<string, SheetState>;
  sheetId?: string;
  code?: { x: number; y: number; sheetId: string; language: CodeCellLanguage };
  insertAndRunCodeInNewSheet?: { language: CodeCellLanguage; codeString: string };
}

export class UrlParamsDev {
  dirty = false;

  private state: UrlParamsDevState = {
    sheets: {},
    code: undefined,
    insertAndRunCodeInNewSheet: undefined,
  };

  constructor(params: URLSearchParams) {
    const read = params.get(URL_STATE_PARAM);
    if (read) {
      // We need this timeout to ensure the setEditorInteraction is set in
      // pixiAppSettings before we try to load the code.
      setTimeout(() => {
        try {
          this.state = JSON.parse(atob(read));
          this.loadSheets();
          this.loadCode();
          this.loadCodeAndRun();
        } catch (e) {
          console.warn('Unable to parse URL param ?state=', e);
        }
      }, WAIT_FOR_SET_EDITOR_INTERACTION_STATE_TIMEOUT_MS);
    }
    this.setupListeners();
  }

  // Loads the sheet.cursor state from the URL.
  private loadSheets() {
    for (const sheetId in this.state.sheets) {
      const sheet = sheets.getById(sheetId);
      if (sheet) {
        const { cursor, viewport } = this.state.sheets[sheetId];
        sheet.cursor.load(cursor);
        if (viewport) {
          sheet.cursor.viewport = viewport;
        }
      }
    }
    if (this.state.sheetId && sheets.getById(this.state.sheetId)) {
      sheets.current = this.state.sheetId;
    }
  }

  private loadCode() {
    if (this.state.code) {
      const { x, y, sheetId, language: code } = this.state.code;
      const sheet = sheets.getById(sheetId);
      if (sheet) {
        if (!pixiAppSettings.setEditorInteractionState) {
          throw new Error('Expected setEditorInteractionState to be set in urlParams.loadCode');
        }
        pixiAppSettings.setEditorInteractionState?.({
          ...pixiAppSettings.editorInteractionState,
          showCodeEditor: true,
          mode: code,
          selectedCell: {
            x,
            y,
          },
          selectedCellSheet: sheetId,
        });
      }
    }
  }

  private loadCodeAndRun() {
    if (this.state.insertAndRunCodeInNewSheet) {
      const x = 0;
      const y = 0;
      const sheetId = sheets.current;
      const { language, codeString } = this.state.insertAndRunCodeInNewSheet;

      // TODO: (jimniels) remove
      console.log(
        [
          `Inserting:`,
          `x: ${x}`,
          `y: ${y}`,
          `sheetId: ${sheetId}`,
          `language: ${JSON.stringify(language)}`,
          `codeString:\n  ${codeString.split('\n').join('\n  ')}`,
        ].join('\n')
      );

      if (!pixiAppSettings.setEditorInteractionState) {
        throw new Error('Expected setEditorInteractionState to be set in urlParams.insertAndRunCodeInNewSheet');
      }
      pixiAppSettings.setEditorInteractionState?.({
        ...pixiAppSettings.editorInteractionState,
        showCodeEditor: true,
        mode: language,
        selectedCell: {
          x,
          y,
        },
        selectedCellSheet: sheetId,
      });

      quadraticCore.setCodeCellValue({
        x,
        y,
        sheetId,
        language,
        codeString,
      });

      // Remove the `state` param when we're done
      // TODO: (jimniels) this doesn't work for connections
      const url = new URL(window.location.href);
      const params = new URLSearchParams(url.search);
      params.delete('state');
      url.search = params.toString();
      window.history.replaceState(null, '', url.toString());
    }
  }

  private setupListeners() {
    events.on('cursorPosition', this.updateCursorViewport);
    events.on('changeSheet', this.updateSheet);
    events.on('codeEditor', this.updateCode);
    pixiApp.viewport.on('moved', this.updateCursorViewport);
    pixiApp.viewport.on('zoomed', this.updateCursorViewport);
  }

  private updateCursorViewport = () => {
    this.state.sheets[sheets.current] = {
      cursor: sheets.sheet.cursor.save(),
      viewport: sheets.sheet.cursor.viewport,
    };
    this.dirty = true;
  };

  private updateSheet = () => {
    this.state.sheetId = sheets.current;
    this.dirty = true;
  };

  private updateCode = () => {
    const state = pixiAppSettings.editorInteractionState;
    const { showCodeEditor, mode, selectedCell, selectedCellSheet } = state;
    if (!showCodeEditor) {
      this.state.code = undefined;
    } else {
      this.state.code = {
        x: selectedCell.x,
        y: selectedCell.y,
        sheetId: selectedCellSheet,
        language: mode as CodeCellLanguage,
      };
    }
    this.dirty = true;
  };

  updateParams() {
    if (this.dirty) {
      const url = new URLSearchParams(window.location.search);
      url.set(URL_STATE_PARAM, btoa(JSON.stringify(this.state)));
      this.dirty = false;
      window.history.replaceState({}, '', `?${url.toString()}`);
    }
  }
}
