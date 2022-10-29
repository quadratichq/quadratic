import { EditorInteractionState, editorInteractionStateDefault } from '../../../atoms/editorInteractionStateAtom';
import { GridInteractionState, gridInteractionStateDefault } from '../../../atoms/gridInteractionStateAtom';
import { defaultGridSettings, GridSettings } from '../useGridSettings';
import { PixiApp } from './PixiApp';

export class PixiAppSettings {
  private app: PixiApp;
  private settings!: GridSettings;
  interactionState = gridInteractionStateDefault;
  setInteractionState?: (value: GridInteractionState) => void;
  editorInteractionState = editorInteractionStateDefault;
  setEditorInteractionState?: (value: EditorInteractionState) => void;
  zoomState = 100;
  setZoomState?: (value: number) => void;

  constructor(app: PixiApp) {
    this.app = app;
    this.getSettings();
    window.addEventListener('grid-settings', this.getSettings);
  }

  destroy() {
    window.removeEventListener('grid-settings', this.getSettings);
  }

  private getSettings = (): void => {
    const settings = localStorage.getItem('gridSettings');
    if (settings) {
      this.settings = JSON.parse(settings) as GridSettings;
    } else {
      this.settings = defaultGridSettings;
    }
    this.app.gridLines.dirty = true;
    this.app.axesLines.dirty = true;
    this.app.headings.dirty = true;
  }

  populate(options: {
    interactionState: GridInteractionState;
    setInteractionState: (value: GridInteractionState) => void;
    editorInteractionState: EditorInteractionState;
    setEditorInteractionState: (value: EditorInteractionState) => void;
    zoomState: number;
    setZoomState: (value: number) => void;
  }) {
    this.interactionState = options.interactionState;
    this.setInteractionState = options.setInteractionState;
    this.editorInteractionState = options.editorInteractionState;
    this.setEditorInteractionState = options.setEditorInteractionState;
    this.zoomState = options.zoomState;
    this.setZoomState = options.setZoomState;
  }

  get showGridLines(): boolean {
    return this.settings.showGridLines;
  }
  get showGridAxes(): boolean {
    return this.settings.showGridAxes;
  }
  get showHeadings(): boolean {
    return this.settings.showHeadings;
  }
  get showCellTypeOutlines(): boolean {
    return this.settings.showCellTypeOutlines;
  }
}