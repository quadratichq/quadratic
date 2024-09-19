import { Action } from '@/app/actions/actions';
import { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { openCodeEditor } from '@/app/grid/actions/openCodeEditor';
import { sheets } from '@/app/grid/controller/Sheets';
import { zoomIn, zoomInOut, zoomOut, zoomToFit, zoomToSelection } from '@/app/gridGL/helpers/zoom';
import { moveViewport } from '@/app/gridGL/interaction/viewportHelper';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { CodeIcon, GoToIcon } from '@/shared/components/Icons';

type ViewActionSpec = Pick<
  ActionSpecRecord,
  | Action.ZoomIn
  | Action.ZoomOut
  | Action.ZoomToSelection
  | Action.ZoomToFit
  | Action.ZoomTo50
  | Action.ZoomTo100
  | Action.ZoomTo200
  | Action.GridPanMode
  | Action.ShowCommandPalette
  | Action.TogglePresentationMode
  | Action.CloseOverlay
  | Action.SwitchSheetNext
  | Action.SwitchSheetPrevious
  | Action.PageUp
  | Action.PageDown
  | Action.ShowGoToMenu
  | Action.ShowCellTypeMenu
>;

export const viewActionsSpec: ViewActionSpec = {
  [Action.ZoomIn]: {
    label: 'Zoom in',
    run: () => {
      zoomIn();
    },
  },
  [Action.ZoomOut]: {
    label: 'Zoom out',
    run: () => {
      zoomOut();
    },
  },
  [Action.ZoomToSelection]: {
    label: 'Zoom to selection',
    run: () => {
      zoomToSelection();
    },
  },
  [Action.ZoomToFit]: {
    label: 'Zoom to fit',
    run: () => {
      zoomToFit();
    },
  },
  [Action.ZoomTo50]: {
    label: 'Zoom to 50%',
    run: () => {
      zoomInOut(0.5);
    },
  },
  [Action.ZoomTo100]: {
    label: 'Zoom to 100%',
    run: () => {
      zoomInOut(1);
    },
  },
  [Action.ZoomTo200]: {
    label: 'Zoom to 200%',
    run: () => {
      zoomInOut(2);
    },
  },
  [Action.GridPanMode]: {
    label: 'Grid pan mode',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ShowCommandPalette]: {
    label: 'Show command palette',
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showFeedbackMenu: false,
        showCellTypeMenu: false,
        showGoToMenu: false,
        showShareFileMenu: false,
        showCommandPalette: !prev.showCommandPalette,
      }));
    },
  },
  [Action.TogglePresentationMode]: {
    label: 'Toggle presentation mode',
    run: () => {
      if (!pixiAppSettings.setGridSettings) return;
      pixiAppSettings.setGridSettings((prev) => ({
        ...prev,
        presentationMode: !prev.presentationMode,
      }));
    },
  },
  [Action.CloseOverlay]: {
    label: 'Close overlay',
    run: () => {
      if (pixiAppSettings.setGridSettings) {
        pixiAppSettings.setGridSettings((prev) => ({
          ...prev,
          presentationMode: false,
        }));
      }
      if (pixiAppSettings.setEditorInteractionState) {
        pixiAppSettings.setEditorInteractionState((prev) => ({
          ...prev,
          showCellTypeMenu: false,
          showCodeEditor: false,
          showCommandPalette: false,
          showConnectionsMenu: false,
          showGoToMenu: false,
          showFeedbackMenu: false,
          showNewFileMenu: false,
          showRenameFileMenu: false,
          showShareFileMenu: false,
          showSearch: false,
          showValidation: false,
          showAI: false,
        }));
      }
    },
  },
  [Action.SwitchSheetNext]: {
    label: 'Switch sheet next',
    run: () => {
      if (sheets.size > 1) {
        const nextSheet = sheets.getNext(sheets.sheet.order) ?? sheets.getFirst();
        sheets.current = nextSheet.id;
      }
    },
  },
  [Action.SwitchSheetPrevious]: {
    label: 'Switch sheet previous',
    run: () => {
      if (sheets.size > 1) {
        const previousSheet = sheets.getPrevious(sheets.sheet.order) ?? sheets.getLast();
        sheets.current = previousSheet.id;
      }
    },
  },
  [Action.PageUp]: {
    label: 'Page up',
    run: () => {
      moveViewport({ pageUp: true });
    },
  },
  [Action.PageDown]: {
    label: 'Page down',
    run: () => {
      moveViewport({ pageDown: true });
    },
  },
  [Action.ShowGoToMenu]: {
    label: 'Go to',
    Icon: GoToIcon,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showGoToMenu: true }));
    },
  },
  [Action.ShowCellTypeMenu]: {
    label: 'Code editor',
    Icon: CodeIcon,
    run: () => {
      openCodeEditor();
    },
  },
};
