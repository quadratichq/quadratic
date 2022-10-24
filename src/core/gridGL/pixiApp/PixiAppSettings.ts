import { EditorInteractionState, editorInteractionStateDefault } from '../../../atoms/editorInteractionStateAtom';
import { GridInteractionState, gridInteractionStateDefault } from '../../../atoms/gridInteractionStateAtom';
import { defaultGridSettings, GridSettings } from '../useGridSettings';
import { PixiApp } from './PixiApp';

export class PixiAppSettings {
  private app: PixiApp;
  private settings!: GridSettings;
  interactionState = gridInteractionStateDefault;
  editorInteractionState = editorInteractionStateDefault;

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
    editorInteractionState: EditorInteractionState;
  }) {
    this.interactionState = options.interactionState;
    this.editorInteractionState = options.editorInteractionState;
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
}