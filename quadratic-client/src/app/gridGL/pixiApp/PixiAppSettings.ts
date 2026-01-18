import type { AIAnalystState } from '@/app/atoms/aiAnalystAtom';
import { defaultAIAnalystState } from '@/app/atoms/aiAnalystAtom';
import type { CodeEditorState } from '@/app/atoms/codeEditorAtom';
import { defaultCodeEditorState } from '@/app/atoms/codeEditorAtom';
import type { ContextMenuState } from '@/app/atoms/contextMenuAtom';
import { ContextMenuType, defaultContextMenuState } from '@/app/atoms/contextMenuAtom';
import type { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { defaultEditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import type { GridPanMode } from '@/app/atoms/gridPanModeAtom';
import { defaultGridPanMode, PanMode } from '@/app/atoms/gridPanModeAtom';
import type { GridSettings } from '@/app/atoms/gridSettingsAtom';
import { defaultGridSettings } from '@/app/atoms/gridSettingsAtom';
import type { InlineEditorState } from '@/app/atoms/inlineEditorAtom';
import { defaultInlineEditor } from '@/app/atoms/inlineEditorAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import type { CursorMode } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { SubmitAIAnalystPromptArgs } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import type { GlobalSnackbar, SnackbarOptions } from '@/shared/components/GlobalSnackbarProvider';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type { JSX } from 'react';
import type { SetterOrUpdater } from 'recoil';

interface Input {
  show: boolean;
  initialValue?: string;
  value?: string;
  cursor?: number;
  x?: number;
  y?: number;
  sheetId?: string;
}

export class PixiAppSettings {
  private settings: GridSettings;
  private lastSettings: GridSettings;
  private _panMode: PanMode;
  private _input: Input;
  private waitingForSnackbar: {
    message: JSX.Element | string;
    options: SnackbarOptions;
  }[] = [];

  // Keeps track of code editor content. This is used when moving code cells to
  // keep track of any unsaved changes, and keyboardCell.
  unsavedEditorChanges?: string;

  temporarilyHideCellTypeOutlines = false;

  gridPanMode = defaultGridPanMode;
  setGridPanMode?: SetterOrUpdater<GridPanMode>;

  gridSettings = defaultGridSettings;
  setGridSettings?: SetterOrUpdater<GridSettings>;

  editorInteractionState = defaultEditorInteractionState;
  setEditorInteractionState?: SetterOrUpdater<EditorInteractionState>;

  addGlobalSnackbar?: GlobalSnackbar['addGlobalSnackbar'];
  closeCurrentSnackbar?: () => void;

  inlineEditorState = defaultInlineEditor;
  setInlineEditorState?: (fn: (prev: InlineEditorState) => InlineEditorState) => void;

  codeEditorState = defaultCodeEditorState;
  setCodeEditorState?: SetterOrUpdater<CodeEditorState>;

  contextMenu = defaultContextMenuState;
  setContextMenu?: SetterOrUpdater<ContextMenuState>;

  aiAnalystState = defaultAIAnalystState;
  setAIAnalystState?: SetterOrUpdater<AIAnalystState>;

  submitAIAnalystPrompt?: (prompt: SubmitAIAnalystPromptArgs) => Promise<void>;

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
    events.off('gridSettings', this.getSettings);
    events.off('contextMenu', this.getContextSettings);
  }

  private getSettings = (): void => {
    // need to wait until pixiApp is initialized before we can set it
    if (!pixiApp?.initialized) return;

    const settings = localStorage.getItem('viewSettings');
    if (settings) {
      this.settings = JSON.parse(settings) as GridSettings;
    } else {
      this.settings = defaultGridSettings;
    }
    events.emit('setDirty', { gridLines: true, headings: true });

    if (
      (this.lastSettings && this.lastSettings.showCellTypeOutlines !== this.settings.showCellTypeOutlines) ||
      (this.lastSettings && this.lastSettings.presentationMode !== this.settings.presentationMode)
    ) {
      pixiApp.setViewportDirty();
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

  updateAIAnalystState(
    aiAnalystState: AIAnalystState,
    setAIAnalystState: SetterOrUpdater<AIAnalystState>,
    submitAIAnalystPrompt: (prompt: SubmitAIAnalystPromptArgs) => Promise<void>
  ): void {
    this.aiAnalystState = aiAnalystState;
    this.setAIAnalystState = setAIAnalystState;
    this.submitAIAnalystPrompt = submitAIAnalystPrompt;
  }

  get showGridLines(): boolean {
    return !this.settings.presentationMode && this.settings.showGridLines;
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
    return !this.settings.presentationMode && this.settings.showCodePeek;
  }

  changeInput(input: boolean, initialValue?: string, cursorMode?: CursorMode) {
    if (input === false) {
      multiplayer.sendEndCellEdit();
    }
    if (
      this._input.show === true &&
      this._input.x !== undefined &&
      this._input.y !== undefined &&
      this._input.sheetId !== undefined
    ) {
      content.cellsSheets.showLabel(this._input.x, this._input.y, this._input.sheetId, true);
    }
    if (input === true) {
      const x = sheets.sheet.cursor.position.x;
      const y = sheets.sheet.cursor.position.y;
      if (multiplayer.cellIsBeingEdited(x, y, sheets.current)) {
        this._input = { show: false };
      } else {
        this._input = { show: input, initialValue, x, y, sheetId: sheets.current };
        content.cellsSheets.showLabel(x, y, sheets.current, false);
      }
    } else {
      this._input = { show: false };
    }
    events.emit('setDirty', { cursor: true });

    // this is used by CellInput to control visibility
    events.emit('changeInput', input, initialValue, cursorMode);
  }

  get input() {
    return this._input;
  }

  get panMode() {
    return this._panMode;
  }

  updateContextMenu(contextMenu: ContextMenuState, setContextMenu: SetterOrUpdater<ContextMenuState>) {
    this.contextMenu = contextMenu;
    this.setContextMenu = setContextMenu;
  }

  // We need this to ensure contextMenu is updated immediately to the state. The
  // above function waits a tick.
  private getContextSettings = (contextMenu: ContextMenuState) => {
    this.contextMenu = contextMenu;
  };

  isRenamingTable(): boolean {
    return !!(
      (this.contextMenu.type === ContextMenuType.Table || this.contextMenu.type === ContextMenuType.TableColumn) &&
      this.contextMenu.rename
    );
  }

  // Check if the grid canvas has focus (or user is editing a cell, or context menu is open)
  isGridFocused(): boolean {
    return document.activeElement === pixiApp.canvas || this.input.show || this.contextMenu.type !== undefined;
  }

  setGlobalSnackbar(addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'], closeGlobalSnackbar: () => void) {
    this.addGlobalSnackbar = addGlobalSnackbar;
    this.closeCurrentSnackbar = closeGlobalSnackbar;
    for (const snackbar of this.waitingForSnackbar) {
      this.addGlobalSnackbar(snackbar.message, snackbar.options);
    }
    this.waitingForSnackbar = [];
  }

  snackbar(message: string, options: SnackbarOptions) {
    if (this.addGlobalSnackbar) {
      this.addGlobalSnackbar(message, options);
    } else {
      this.waitingForSnackbar.push({ message, options });
    }
  }
}

export const pixiAppSettings = new PixiAppSettings();
