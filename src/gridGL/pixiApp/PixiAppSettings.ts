import {
  EditorHighlightedCellsState,
  editorHighlightedCellsStateDefault,
} from '../../atoms/editorHighlightedCellsStateAtom';
import { EditorInteractionState, editorInteractionStateDefault } from '../../atoms/editorInteractionStateAtom';
import { CellValue } from '../../quadratic-core/types';
import { GridSettings, defaultGridSettings } from '../../ui/menus/TopBar/SubMenus/useGridSettings';
import { pixiApp } from './PixiApp';
import { pixiAppEvents } from './PixiAppEvents';

export enum PanMode {
  Disabled = 'DISABLED',
  Enabled = 'ENABLED',
  Dragging = 'DRAGGING',
}

export class PixiAppSettings {
  private settings: GridSettings;
  private lastSettings: GridSettings;
  private _panMode: PanMode;
  private _input: { show: boolean; initialValue?: string };

  temporarilyHideCellTypeOutlines = false;
  editorInteractionState = editorInteractionStateDefault;
  setEditorInteractionState?: (value: EditorInteractionState) => void;
  editorHighlightedCellsState = editorHighlightedCellsStateDefault;
  setEditorHighlightedCellsState?: (value: EditorHighlightedCellsState) => void;

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

    // only rebuild quadrants if showCellTypeOutlines change
    if (
      (this.lastSettings && this.lastSettings.showCellTypeOutlines !== this.settings.showCellTypeOutlines) ||
      (this.lastSettings && this.lastSettings.presentationMode !== this.settings.presentationMode)
    ) {
      pixiApp.cellsSheets.toggleOutlines();
      pixiApp.viewport.dirty = true;
      // pixiApp.quadrants.build();
    }
    this.lastSettings = this.settings;
  };

  updateEditorInteractionState(
    editorInteractionState: EditorInteractionState,
    setEditorInteractionState: (value: EditorInteractionState) => void
  ): void {
    this.editorInteractionState = editorInteractionState;
    this.setEditorInteractionState = setEditorInteractionState;
    pixiApp.headings.dirty = true;
    pixiApp.cursor.dirty = true;
    // pixiApp.cells.dirty = true;
  }

  updateEditorHighlightedCellsState(
    editorHighlightedCellsState: EditorHighlightedCellsState,
    setEditorHighlightedCellsState: (value: EditorHighlightedCellsState) => void
  ): void {
    this.editorHighlightedCellsState = editorHighlightedCellsState;
    this.setEditorHighlightedCellsState = setEditorHighlightedCellsState;
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
    if (this.editorInteractionState.showCodeEditor && this.editorInteractionState.mode === 'FORMULA') {
      return true;
    }
    return this.settings.showA1Notation;
  }

  changeInput(input: boolean, initialValue: CellValue | undefined = undefined) {
    // todo: this does not handle types other than text
    this._input = { show: input, initialValue: initialValue ? (initialValue as any).value?.toString() : undefined };
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
