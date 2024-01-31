import { multiplayer } from '@/multiplayer/multiplayer';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { EditorInteractionState, editorInteractionStateDefault } from '../../atoms/editorInteractionStateAtom';
import { sheets } from '../../grid/controller/Sheets';
import { GridSettings, defaultGridSettings } from '../../ui/menus/TopBar/SubMenus/useGridSettings';
import { pixiApp } from './PixiApp';

export enum PanMode {
  Disabled = 'DISABLED',
  Enabled = 'ENABLED',
  Dragging = 'DRAGGING',
}

interface Input {
  show: boolean;
  initialValue?: string;
  value?: string;
  cursor?: number;
  x?: number;
  y?: number;
  sheetId?: string;
}

class PixiAppSettings {
  private settings: GridSettings;
  private lastSettings: GridSettings;
  private _panMode: PanMode;
  private _input: Input;

  temporarilyHideCellTypeOutlines = false;
  editorInteractionState = editorInteractionStateDefault;
  setEditorInteractionState?: (value: EditorInteractionState) => void;

  constructor() {
    const settings = localStorage.getItem('viewSettings');
    if (settings) {
      this.settings = JSON.parse(settings) as GridSettings;
    } else {
      this.settings = defaultGridSettings;
    }
    this.lastSettings = this.settings;
    window.addEventListener('grid-settings', this.getSettings.bind(this));
    this._input = { show: false };
    this._panMode = PanMode.Disabled;
  }

  destroy() {
    window.removeEventListener('grid-settings', this.getSettings.bind(this));
  }

  private getSettings = (): void => {
    const settings = localStorage.getItem('viewSettings');
    if (settings) {
      this.settings = JSON.parse(settings) as GridSettings;
    } else {
      this.settings = defaultGridSettings;
    }
    pixiApp.gridLines.dirty = true;
    pixiApp.axesLines.dirty = true;
    pixiApp.headings.dirty = true;

    if (
      (this.lastSettings && this.lastSettings.showCellTypeOutlines !== this.settings.showCellTypeOutlines) ||
      (this.lastSettings && this.lastSettings.presentationMode !== this.settings.presentationMode)
    ) {
      pixiApp.cellsSheets.updateCellsArray();
      pixiApp.viewport.dirty = true;
    }
    this.lastSettings = this.settings;
  };

  get permissions(): ApiTypes['/v0/files/:uuid.GET.response']['userMakingRequest']['filePermissions'] {
    return this.editorInteractionState.permissions;
  }

  updateEditorInteractionState(
    editorInteractionState: EditorInteractionState,
    setEditorInteractionState: (value: EditorInteractionState) => void
  ): void {
    this.editorInteractionState = editorInteractionState;
    this.setEditorInteractionState = setEditorInteractionState;
    pixiApp.headings.dirty = true;
    pixiApp.cursor.dirty = true;
  }

  get showGridLines(): boolean {
    return !this.settings.presentationMode && this.settings.showGridLines;
  }
  get showGridAxes(): boolean {
    return !this.settings.presentationMode && this.settings.showGridAxes;
  }
  get showHeadings(): boolean {
    return !this.settings.presentationMode && this.settings.showHeadings;
  }
  get showCellTypeOutlines(): boolean {
    return (
      !this.temporarilyHideCellTypeOutlines && !this.settings.presentationMode && this.settings.showCellTypeOutlines
    );
  }
  get presentationMode(): boolean {
    return this.settings.presentationMode;
  }

  get showA1Notation(): boolean {
    if (this.editorInteractionState.showCodeEditor && this.editorInteractionState.mode === 'Formula') {
      return true;
    }
    return this.settings.showA1Notation;
  }

  setDirty(dirty: { cursor?: boolean; headings?: boolean; gridLines?: boolean }): void {
    if (dirty.cursor) {
      pixiApp.cursor.dirty = true;
    }
    if (dirty.headings) {
      pixiApp.headings.dirty = true;
    }
    if (dirty.gridLines) {
      pixiApp.gridLines.dirty = true;
    }
  }

  changeInput(input: boolean, initialValue?: string) {
    if (input === false) {
      multiplayer.sendEndCellEdit();
    }
    if (
      this._input.show === true &&
      this._input.x !== undefined &&
      this._input.y !== undefined &&
      this._input.sheetId !== undefined
    ) {
      pixiApp.cellsSheets.showLabel(this._input.x, this._input.y, this._input.sheetId, true);
    }
    if (input === true) {
      const x = sheets.sheet.cursor.cursorPosition.x;
      const y = sheets.sheet.cursor.cursorPosition.y;
      if (multiplayer.cellIsBeingEdited(x, y, sheets.sheet.id)) {
        this._input = { show: false };
      } else {
        this._input = { show: input, initialValue, x, y, sheetId: sheets.sheet.id };
        pixiApp.cellsSheets.showLabel(x, y, sheets.sheet.id, false);
      }
    } else {
      this._input = { show: false };
    }
    this.setDirty({ cursor: true });

    // this is used by CellInput to control visibility
    window.dispatchEvent(new CustomEvent('change-input', { detail: { showInput: input } }));
  }

  changePanMode(mode: PanMode): void {
    if (this._panMode !== mode) {
      this._panMode = mode;

      // this is used by QuadraticGrid to trigger changes in pan mode
      window.dispatchEvent(new CustomEvent('pan-mode', { detail: mode }));
    }
  }

  get input() {
    return this._input;
  }

  get panMode() {
    return this._panMode;
  }
}

export const pixiAppSettings = new PixiAppSettings();
