import {
  EditorHighlightedCellsState,
  editorHighlightedCellsStateDefault,
} from '../../atoms/editorHighlightedCellsStateAtom';
import { EditorInteractionState, editorInteractionStateDefault } from '../../atoms/editorInteractionStateAtom';
import { GridSettings, defaultGridSettings } from '../../ui/menus/TopBar/SubMenus/useGridSettings';
import { PixiApp } from './PixiApp';
import { pixiAppEvents } from './PixiAppEvents';

export enum PanMode {
  Disabled = 'DISABLED',
  Enabled = 'ENABLED',
  Dragging = 'DRAGGING',
}

export class PixiAppSettings {
  private app: PixiApp;
  private settings!: GridSettings;
  private lastSettings?: GridSettings;
  private _panMode: PanMode;
  private _input: { show: boolean; initialValue?: string };

  temporarilyHideCellTypeOutlines = false;
  editorInteractionState = editorInteractionStateDefault;
  setEditorInteractionState?: (value: EditorInteractionState) => void;
  editorHighlightedCellsState = editorHighlightedCellsStateDefault;
  setEditorHighlightedCellsState?: (value: EditorHighlightedCellsState) => void;

  constructor(app: PixiApp) {
    this.app = app;
    this.getSettings();
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
    this.app.gridLines.dirty = true;
    this.app.axesLines.dirty = true;
    this.app.headings.dirty = true;
    // this.app.cells.dirty = true;

    // only rebuild quadrants if showCellTypeOutlines change
    if (
      (this.lastSettings && this.lastSettings.showCellTypeOutlines !== this.settings.showCellTypeOutlines) ||
      (this.lastSettings && this.lastSettings.presentationMode !== this.settings.presentationMode)
    ) {
      this.app.cellsSheets.toggleOutlines();
      this.app.viewport.dirty = true;
      // this.app.quadrants.build();
    }
    this.lastSettings = this.settings;
  };

  updateEditorInteractionState(
    editorInteractionState: EditorInteractionState,
    setEditorInteractionState: (value: EditorInteractionState) => void
  ): void {
    this.editorInteractionState = editorInteractionState;
    this.setEditorInteractionState = setEditorInteractionState;
    this.app.headings.dirty = true;
    this.app.cursor.dirty = true;
    // this.app.cells.dirty = true;
  }

  updateEditorHighlightedCellsState(
    editorHighlightedCellsState: EditorHighlightedCellsState,
    setEditorHighlightedCellsState: (value: EditorHighlightedCellsState) => void
  ): void {
    this.editorHighlightedCellsState = editorHighlightedCellsState;
    this.setEditorHighlightedCellsState = setEditorHighlightedCellsState;
    this.app.cursor.dirty = true;
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
    if (this.editorInteractionState.showCodeEditor && this.editorInteractionState.mode === 'FORMULA') {
      return true;
    }
    return this.settings.showA1Notation;
  }

  changeInput(input: boolean, initialValue = '') {
    this._input = { show: input, initialValue };
    pixiAppEvents.setDirty({ cursor: true });

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
