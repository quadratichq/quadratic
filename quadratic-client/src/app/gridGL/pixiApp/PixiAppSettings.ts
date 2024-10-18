import { CodeEditorState, defaultCodeEditorState } from '@/app/atoms/codeEditorAtom';
import { ContextMenuOptions, ContextMenuState, defaultContextMenuState } from '@/app/atoms/contextMenuAtom';
import { EditorInteractionState, editorInteractionStateDefault } from '@/app/atoms/editorInteractionStateAtom';
import { defaultGridPanMode, GridPanMode, PanMode } from '@/app/atoms/gridPanModeAtom';
import { defaultGridSettings, GridSettings } from '@/app/atoms/gridSettingsAtom';
import { defaultInlineEditor, InlineEditorState } from '@/app/atoms/inlineEditorAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { GlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { SetterOrUpdater } from 'recoil';

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

  // Keeps track of code editor content. This is used when moving code cells to
  // keep track of any unsaved changes, and keyboardCell.
  unsavedEditorChanges?: string;

  temporarilyHideCellTypeOutlines = false;

  gridPanMode = defaultGridPanMode;
  setGridPanMode?: SetterOrUpdater<GridPanMode>;

  gridSettings = defaultGridSettings;
  setGridSettings?: SetterOrUpdater<GridSettings>;

  editorInteractionState = editorInteractionStateDefault;
  setEditorInteractionState?: SetterOrUpdater<EditorInteractionState>;

  addGlobalSnackbar?: GlobalSnackbar['addGlobalSnackbar'];

  inlineEditorState = defaultInlineEditor;
  setInlineEditorState?: (fn: (prev: InlineEditorState) => InlineEditorState) => void;

  codeEditorState = defaultCodeEditorState;
  setCodeEditorState?: SetterOrUpdater<CodeEditorState>;

  contextMenu = defaultContextMenuState;
  setContextMenu?: SetterOrUpdater<ContextMenuOptions>;

  constructor() {
    const settings = localStorage.getItem('viewSettings');
    if (settings) {
      this.settings = JSON.parse(settings) as GridSettings;
    } else {
      this.settings = defaultGridSettings;
    }
    this.lastSettings = this.settings;
    events.on('gridSettings', this.getSettings);
    events.on('contextMenu', this.getContextSettings);
    this._input = { show: false };
    this._panMode = PanMode.Disabled;
  }

  destroy() {
    window.removeEventListener('gridSettings', this.getSettings);
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

  updateGridPanMode(gridPanMode: GridPanMode, setGridPanMode: SetterOrUpdater<GridPanMode>): void {
    if (gridPanMode.panMode === PanMode.Enabled) {
      pixiApp.canvas.style.cursor = 'grab';
    } else if (gridPanMode.panMode === PanMode.Dragging) {
      pixiApp.canvas.style.cursor = 'grabbing';
    } else if (gridPanMode.panMode !== PanMode.Disabled) {
      pixiApp.canvas.style.cursor = 'unset';
    }

    this._panMode = gridPanMode.panMode;
    this.gridPanMode = gridPanMode;
    this.setGridPanMode = setGridPanMode;
  }

  updateGridSettings(gridSettings: GridSettings, setGridSettings: SetterOrUpdater<GridSettings>): void {
    this.gridSettings = gridSettings;
    this.setGridSettings = setGridSettings;
  }

  updateEditorInteractionState(
    editorInteractionState: EditorInteractionState,
    setEditorInteractionState: SetterOrUpdater<EditorInteractionState>
  ): void {
    this.editorInteractionState = editorInteractionState;
    this.setEditorInteractionState = setEditorInteractionState;
  }

  updateInlineEditorState(
    inlineEditorState: InlineEditorState,
    setInlineEditorState: (fn: (prev: InlineEditorState) => InlineEditorState) => void
  ): void {
    this.inlineEditorState = inlineEditorState;
    this.setInlineEditorState = setInlineEditorState;
  }

  updateCodeEditorState(codeEditorState: CodeEditorState, setCodeEditorState: SetterOrUpdater<CodeEditorState>): void {
    this.codeEditorState = codeEditorState;
    this.setCodeEditorState = setCodeEditorState;
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
    if (
      (this.codeEditorState.showCodeEditor && this.codeEditorState.codeCell.language === 'Formula') ||
      inlineEditorHandler.isEditingFormula()
    ) {
      return true;
    }
    return this.settings.showA1Notation;
  }

  get showCodePeek(): boolean {
    return !this.settings.presentationMode && this.codeEditorState.showCodeEditor;
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
    events.emit('changeInput', input, initialValue);
  }

  get input() {
    return this._input;
  }

  get panMode() {
    return this._panMode;
  }

  updateContextMenu(contextMenu: ContextMenuState, setContextMenu: SetterOrUpdater<ContextMenuOptions>) {
    this.contextMenu = contextMenu;
    this.setContextMenu = setContextMenu;
  }

  // We need this to ensure contextMenu is updated immediately to the state. The
  // above function waits a tick.
  private getContextSettings = (contextMenu: ContextMenuState) => {
    this.contextMenu = contextMenu;
  };
}

export const pixiAppSettings = new PixiAppSettings();
