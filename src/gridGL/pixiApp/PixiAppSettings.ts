import { EditorInteractionState, editorInteractionStateDefault } from '../../atoms/editorInteractionStateAtom';
import { GridInteractionState, gridInteractionStateDefault } from '../../atoms/gridInteractionStateAtom';
import { defaultGridSettings, GridSettings } from '../../ui/menus/TopBar/SubMenus/useGridSettings';
import { PixiApp } from './PixiApp';

export class PixiAppSettings {
  private app: PixiApp;
  private settings!: GridSettings;
  private lastSettings?: GridSettings;
  interactionState = gridInteractionStateDefault;
  setInteractionState?: (value: GridInteractionState) => void;
  editorInteractionState = editorInteractionStateDefault;
  setEditorInteractionState?: (value: EditorInteractionState) => void;

  constructor(app: PixiApp) {
    this.app = app;
    this.getSettings();
    window.addEventListener('grid-settings', this.getSettings);
  }

  destroy() {
    window.removeEventListener('grid-settings', this.getSettings);
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
    this.app.cells.dirty = true;

    // only rebuild quadrants if showCellTypeOutlines change
    if (this.lastSettings && this.lastSettings.showCellTypeOutlines !== this.settings.showCellTypeOutlines) {
      this.app.quadrants.build();
    }
    this.lastSettings = this.settings;
  };

  updateInteractionState(
    interactionState: GridInteractionState,
    setInteractionState: (value: GridInteractionState) => void
  ): void {
    this.interactionState = interactionState;
    this.setInteractionState = setInteractionState;
    this.app.cursor.dirty = true;
    this.app.headings.dirty = true;
    this.app.cells.dirty = true;
  }

  updateEditorInteractionState(
    editorInteractionState: EditorInteractionState,
    setEditorInteractionState: (value: EditorInteractionState) => void
  ): void {
    this.editorInteractionState = editorInteractionState;
    this.setEditorInteractionState = setEditorInteractionState;
    this.app.headings.dirty = true;
    this.app.cursor.dirty = true;
  }

  get showGridLines(): boolean {
    return this.settings.showUI && this.settings.showGridLines;
  }
  get showGridAxes(): boolean {
    return this.settings.showUI && this.settings.showGridAxes;
  }
  get showHeadings(): boolean {
    return this.settings.showUI && this.settings.showHeadings;
  }
  get showCellTypeOutlines(): boolean {
    return this.settings.showUI && this.settings.showCellTypeOutlines;
  }

  get showA1Notation(): boolean {
    if (this.editorInteractionState.showCodeEditor && this.editorInteractionState.mode === 'FORMULA') {
      return true;
    }
    return this.settings.showA1Notation;
  }
}
