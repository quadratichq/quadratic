/* eslint-disable @typescript-eslint/no-unused-vars */
import { events } from '@/events/events';
import { sheets } from '@/grid/controller/Sheets';
import { SheetCursorSave } from '@/grid/sheet/SheetCursor';
import { CodeCellLanguage } from '@/quadratic-core-types';
import { IViewportTransformState } from 'pixi-viewport';
import { pixiApp } from './PixiApp';
import { pixiAppSettings } from './PixiAppSettings';

const UPDATE_INTERVAL = 100;
const URL_PARAM = 'state';

interface SheetState {
  cursor: SheetCursorSave;
  viewport?: IViewportTransformState;
}

interface State {
  sheets: Record<string, SheetState>;
  sheet?: string;
  code?: { x: number; y: number; l: CodeCellLanguage };
}

class UrlParams {
  private dirty = false;

  // Current params
  private params: State = {
    sheets: {},
  };

  private updateSheet = () => {
    this.params.sheet = sheets.current;
    this.dirty = true;
  };

  private updateCursorViewport = () => {
    this.params.sheets[sheets.current] = {
      cursor: sheets.sheet.cursor.save(),
      viewport: sheets.sheet.cursor.viewport,
    };
    this.dirty = true;
  };

  private updateCode = () => {
    const state = pixiAppSettings.editorInteractionState;
    const { showCodeEditor } = state;
    if (!showCodeEditor) {
      this.params.code = undefined;
    } else {
      const { selectedCell, mode } = state;
      this.params.code = { x: selectedCell.x, y: selectedCell.y, l: mode as CodeCellLanguage };
    }
    console.log(this.params.code);
    this.dirty = true;
  };

  setupListeners() {
    events.on('cursorPosition', this.updateCursorViewport);
    events.on('changeSheet', this.updateSheet);
    events.on('codeEditor', this.updateCode);
    pixiApp.viewport.on('moved', this.updateCursorViewport);
    pixiApp.viewport.on('zoomed', this.updateCursorViewport);
  }
  // Loads the sheet.cursor state from the URL.
  initSheets() {
    for (const sheetId in this.params.sheets) {
      const sheet = sheets.getById(sheetId);
      if (sheet) {
        const { cursor, viewport } = this.params.sheets[sheetId];
        sheet.cursor.load(cursor);
        if (viewport) {
          sheet.cursor.viewport = viewport;
        }
      }
    }
    if (this.params.sheet && sheets.getById(this.params.sheet)) {
      sheets.current = this.params.sheet;
    }
  }

  // Loads the code editor from the URL.
  initCode() {
    if (this.params.code && this.params.sheet) {
      const { x, y, l } = this.params.code;
      const sheet = sheets.getById(this.params.sheet);
      if (sheet) {
        if (!pixiAppSettings.setEditorInteractionState) {
          throw new Error('Expected setEditorInteractionState to be set in urlParams.initCode');
        }
        pixiAppSettings.setEditorInteractionState?.({
          ...pixiAppSettings.editorInteractionState,
          showCodeEditor: true,
          mode: l,
          selectedCell: {
            x,
            y,
          },
          selectedCellSheet: sheet.id,
        });
      }
    }
  }

  update = () => {
    if (this.dirty) {
      this.dirty = false;
      const url = new URLSearchParams(window.location.search);
      url.set(URL_PARAM, btoa(JSON.stringify(this.params)));
      window.history.replaceState({}, '', `?${url.toString()}`);
    }
  };

  init() {
    this.setupListeners();
    this.readParams();
    this.initSheets();
  }

  show() {
    this.initCode();
    setInterval(this.update, UPDATE_INTERVAL);
  }

  private readParams() {
    const params = new URLSearchParams(window.location.search);
    const read = params.get(URL_PARAM);
    if (read) {
      try {
        this.params = JSON.parse(atob(read));
      } catch (e) {
        console.warn('Unable to parse URL param ?save=');
      }
    }

    //   // change CodeEditor based on URL
    //   const codeX = params.has('codeX') ? parseInt(params.get('codeX')!) : undefined;
    //   const codeY = params.has('codeY') ? parseInt(params.get('codeY')!) : undefined;
    //   let codeLanguage = params.get('codeLanguage');
    //   if (codeLanguage) {
    //     codeLanguage = codeLanguage[0].toUpperCase() + codeLanguage.slice(1).toLowerCase();
    //     if (!['Python', 'Javascript', 'Formula'].includes(codeLanguage)) {
    //       codeLanguage = null;
    //     }
    //   }
    //   let codeSheetName = params.get('codeSheet');
    //   if (codeLanguage !== undefined && codeX !== undefined && codeY !== undefined && !isNaN(codeX) && !isNaN(codeY)) {
    //     let codeSheet = codeSheetName ? sheets.getSheetByName(codeSheetName, true) : undefined;
    //     codeSheet = codeSheet || sheets.getFirst();
    //     const sheetId = codeSheet.id;
    //     pixiAppSettings.setEditorInteractionState?.({
    //       ...pixiAppSettings.editorInteractionState,
    //       showCodeEditor: true,
    //       mode: codeLanguage as CodeCellLanguage,
    //       selectedCell: {
    //         x: codeX,
    //         y: codeY,
    //       },
    //       selectedCellSheet: sheetId,
    //     });
    //   }
  }
}

export const urlParams = new UrlParams();
