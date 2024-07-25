//! User-focused URL parameters (default behavior)

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { CodeCellLanguage } from '@/app/quadratic-core-types';

export class UrlParamsUser {
  dirty = false;

  constructor(params: URLSearchParams) {
    this.loadSheet(params);
    this.loadCursor(params);
    this.loadCode(params);
    this.setupListeners();
  }

  private loadSheet(params: URLSearchParams) {
    const sheetName = params.get('sheet');
    if (sheetName) {
      const sheetId = sheets.getSheetByName(decodeURI(sheetName), true)?.id;
      if (sheetId) {
        sheets.current = sheetId;
        return;
      }
    }
  }

  private loadCursor(params: URLSearchParams) {
    const x = parseInt(params.get('x') ?? '');
    const y = parseInt(params.get('y') ?? '');
    if (!isNaN(x) && !isNaN(y)) {
      sheets.sheet.cursor.changePosition({
        cursorPosition: { x, y },
        keyboardMovePosition: { x, y },
        ensureVisible: true,
      });
    }
  }

  private loadCode(params: URLSearchParams) {
    const code = params.get('code');
    if (code) {
      let language: CodeCellLanguage | undefined;
      if (code === 'python') language = 'Python';
      // else if (code === 'javascript') language = 'JavaScript';
      else if (code === 'formula') language = 'Formula';
      if (language) {
        if (!pixiAppSettings.setEditorInteractionState) {
          throw new Error('Expected setEditorInteractionState to be set in urlParams.loadCode');
        }
        pixiAppSettings.setEditorInteractionState?.({
          ...pixiAppSettings.editorInteractionState,
          showCodeEditor: true,
          mode: language,
          selectedCellSheet: sheets.sheet.id,
          selectedCell: { x: sheets.sheet.cursor.cursorPosition.x, y: sheets.sheet.cursor.cursorPosition.y },
        });
      }
    }
  }

  private setupListeners() {
    events.on('cursorPosition', this.setDirty);
    events.on('changeSheet', this.setDirty);
    events.on('codeEditor', this.setDirty);
  }

  private setDirty = () => {
    this.dirty = true;
  };

  updateParams() {
    if (this.dirty) {
      this.dirty = false;
      const url = new URLSearchParams(window.location.search);
      const state = pixiAppSettings.editorInteractionState;

      // if code editor is open, we use its x, y, and sheet name
      if (state.showCodeEditor && state.mode) {
        url.set('code', getLanguage(state.mode).toLowerCase());
        url.set('x', state.selectedCell.x.toString());
        url.set('y', state.selectedCell.y.toString());
        if (state.selectedCellSheet !== sheets.getFirst().id) {
          const sheetName = sheets.getById(state.selectedCellSheet)?.name;
          if (!sheetName) {
            throw new Error('Expected to find sheet in urlParams.updateParams');
          }
          url.set('sheet', encodeURI(sheetName));
        } else {
          url.delete('sheet');
        }
      }

      // otherwise we use the normal cursor
      else {
        const cursor = sheets.sheet.cursor.cursorPosition;
        url.set('x', cursor.x.toString());
        url.set('y', cursor.y.toString());
        if (sheets.sheet !== sheets.getFirst()) {
          url.set('sheet', encodeURI(sheets.sheet.name));
        } else {
          url.delete('sheet');
        }
        url.delete('code');
      }
      window.history.replaceState({}, '', `?${url.toString()}`);
    }
  }
}
