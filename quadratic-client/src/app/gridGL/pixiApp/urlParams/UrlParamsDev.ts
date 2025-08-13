//! Dev-focused parameters enabled by `debugFlags.saveURLState = true;`

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { IViewportTransformState } from 'pixi-viewport';

const URL_STATE_PARAM = 'state';
const WAIT_FOR_SET_EDITOR_INTERACTION_STATE_TIMEOUT_MS = 100;

interface SheetState {
  cursor: string;
  viewport?: IViewportTransformState;
}

export interface UrlParamsDevState {
  sheets: Record<string, SheetState>;
  sheetId?: string;
  code?: { x: number; y: number; sheetId: string; language: CodeCellLanguage };
  validation?: boolean | string;
  insertAndRunCodeInNewSheet?: { language: CodeCellLanguage; codeString: string };
}

export class UrlParamsDev {
  dirty = false;
  noUpdates = false;

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
      try {
        this.state = JSON.parse(atob(read));
      } catch (e) {
        console.warn('Unable to parse URL param ?state=', e);
      }

      setTimeout(() => {
        this.loadSheets();
        this.loadCode();
        this.loadValidation();
        this.loadCodeAndRun();
        if (!this.noUpdates) {
          this.setupListeners();
        }
      }, WAIT_FOR_SET_EDITOR_INTERACTION_STATE_TIMEOUT_MS);
    }
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
        if (!pixiAppSettings.setCodeEditorState) {
          throw new Error('Expected setEditorInteractionState to be set in urlParams.loadCode');
        }
        pixiAppSettings.setCodeEditorState((prev) => ({
          ...prev,
          showCodeEditor: true,
          initialCode: '',
          codeCell: {
            sheetId,
            pos: { x, y },
            language: code,
            lastModified: 0,
          },
        }));
      }
    }
  }

  private loadValidation() {
    if (this.state.validation) {
      if (!pixiAppSettings.setEditorInteractionState) {
        throw new Error('Expected setEditorInteractionState to be set in urlParams.loadValidation');
      }
      pixiAppSettings.setEditorInteractionState({
        ...pixiAppSettings.editorInteractionState,
        showValidation: this.state.validation,
      });
    }
  }

  private loadCodeAndRun() {
    if (this.state.insertAndRunCodeInNewSheet) {
      const x = 1;
      const y = 1;
      const sheetId = sheets.current;
      const { language, codeString } = this.state.insertAndRunCodeInNewSheet;

      // For dev purposes: see what is loading & running
      // console.log(
      //   [
      //     `Inserting:`,
      //     `x: ${x}`,
      //     `y: ${y}`,
      //     `sheetId: ${sheetId}`,
      //     `language: ${JSON.stringify(language)}`,
      //     `codeString:\n  ${codeString.split('\n').join('\n  ')}`,
      //   ].join('\n')
      // );

      if (!pixiAppSettings.setCodeEditorState) {
        throw new Error('Expected setEditorInteractionState to be set in urlParams.insertAndRunCodeInNewSheet');
      }
      pixiAppSettings.setCodeEditorState((prev) => ({
        ...prev,
        showCodeEditor: true,
        initialCode: '',
        codeCell: {
          sheetId,
          pos: { x, y },
          language,
          lastModified: 0,
        },
      }));

      quadraticCore.setCodeCellValue({
        pos: { x, y },
        tablePos: undefined,
        sheetId,
        language,
        codeString,
        isAi: false,
      });

      // Remove the `state` param when we're done
      const url = new URL(window.location.href);
      const params = new URLSearchParams(url.search);
      params.delete('state');
      url.search = params.toString();
      window.history.replaceState(null, '', url.toString());

      this.noUpdates = true;
    }
  }

  private setupListeners() {
    events.on('cursorPosition', this.updateCursorViewport);
    events.on('changeSheet', this.updateSheet);
    events.on('codeEditor', this.updateCode);
    events.on('validation', this.updateValidation);
    events.on('viewportChangedReady', this.updateCursorViewport);
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
    const { showCodeEditor, codeCell } = pixiAppSettings.codeEditorState;
    if (!showCodeEditor) {
      this.state.code = undefined;
    } else {
      this.state.code = {
        sheetId: codeCell.sheetId,
        x: codeCell.pos.x,
        y: codeCell.pos.y,
        language: codeCell.language,
      };
    }
    this.dirty = true;
  };

  private updateValidation = () => {
    const state = pixiAppSettings.editorInteractionState;
    const { showValidation } = state;
    if (!showValidation) {
      this.state.validation = undefined;
    } else {
      this.state.validation = showValidation;
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
