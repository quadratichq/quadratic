import { EditorInteractionState, editorInteractionStateDefault } from '../../../atoms/editorInteractionStateAtom';
import { GridInteractionState, gridInteractionStateDefault } from '../../../atoms/gridInteractionStateAtom';
import { defaultGridSettings, IGridSettings } from '../useGridSettings';

export class PixiAppSettings {
  settings = defaultGridSettings;
  interactionState = gridInteractionStateDefault;
  editorInteractionState = editorInteractionStateDefault;

  populate(options: {
    settings: IGridSettings;
    interactionState: GridInteractionState;
    editorInteractionState: EditorInteractionState;
  }) {
    this.settings = options.settings;
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