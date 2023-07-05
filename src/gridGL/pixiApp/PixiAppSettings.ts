import { EditorInteractionState, editorInteractionStateDefault } from '../../atoms/editorInteractionStateAtom';
import { GridInteractionState, gridInteractionStateDefault } from '../../atoms/gridInteractionStateAtom';
import { defaultGridSettings, GridSettings } from '../../ui/menus/TopBar/SubMenus/useGridSettings';
import { PixiApp } from './PixiApp';

export class PixiAppSettings {
  private app: PixiApp;
  private settings!: GridSettings;
  private lastSettings?: GridSettings;

  // throttle for setting recoil state
  private interactionStateDirty = false;
  private setInteractionStateRecoil?: (value: GridInteractionState) => void;
  private lastShowInput = false;

  temporarilyHideCellTypeOutlines = false;
  interactionState = gridInteractionStateDefault;
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
    if (
      (this.lastSettings && this.lastSettings.showCellTypeOutlines !== this.settings.showCellTypeOutlines) ||
      (this.lastSettings && this.lastSettings.presentationMode !== this.settings.presentationMode)
    ) {
      this.app.quadrants.build();
    }
    this.lastSettings = this.settings;
  };

  setInteractionState = (value: GridInteractionState): void => {
    this.interactionState = value;
    this.interactionStateDirty = true;
  };

  updateInteractionState(
    interactionState: GridInteractionState,
    setInteractionState: (value: GridInteractionState) => void
  ): void {
    this.interactionState = interactionState;
    this.setInteractionStateRecoil = setInteractionState;
    this.interactionStateDirty = false;
    this.app.cursor.dirty = true;
    this.app.headings.dirty = true;
    if (interactionState.showInput !== this.lastShowInput) {
      this.app.cells.dirty = true;
      this.lastShowInput = interactionState.showInput;
    }
  }

  update() {
    // update recoil state only once per frame
    if (this.interactionStateDirty) {
      this.interactionStateDirty = false;
      this.setInteractionStateRecoil?.(this.interactionState);
    }
  }

  updateEditorInteractionState(
    editorInteractionState: EditorInteractionState,
    setEditorInteractionState: (value: EditorInteractionState) => void
  ): void {
    this.editorInteractionState = editorInteractionState;
    this.setEditorInteractionState = setEditorInteractionState;
    this.app.headings.dirty = true;
    this.app.cursor.dirty = true;
    this.app.cells.dirty = true;
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
}
