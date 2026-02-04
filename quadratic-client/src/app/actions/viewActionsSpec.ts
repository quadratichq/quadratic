import { Action } from '@/app/actions/actions';
import type { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { getShowAIAnalyst, setShowAIAnalyst, toggleShowAIAnalyst } from '@/app/ai/atoms/aiAnalystAtoms';
import { events } from '@/app/events/events';
import { openCodeEditor } from '@/app/grid/actions/openCodeEditor';
import { sheets } from '@/app/grid/controller/Sheets';
import { zoomIn, zoomInOut, zoomOut, zoomReset, zoomToFit, zoomToSelection } from '@/app/gridGL/helpers/zoom';
import { pageUpDown } from '@/app/gridGL/interaction/viewportHelper';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { CodeIcon, GoToIcon, MentionIcon } from '@/shared/components/Icons';
import { trackEvent } from '@/shared/utils/analyticsEvents';

type ViewActionSpec = Pick<
  ActionSpecRecord,
  | Action.CmdClick
  | Action.ZoomIn
  | Action.ZoomOut
  | Action.ZoomToSelection
  | Action.ZoomToFit
  | Action.ZoomTo50
  | Action.ZoomTo100
  | Action.ZoomTo200
  | Action.ZoomReset
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
  | Action.ToggleAIAnalyst
  | Action.AddReferenceToAIAnalyst
>;

export type ViewActionArgs = {
  [Action.AddReferenceToAIAnalyst]: string;
};

export const viewActionsSpec: ViewActionSpec = {
  [Action.CmdClick]: {
    label: () => `${KeyboardSymbols.Command}+click`,
    run: () => {},
  },
  [Action.ZoomIn]: {
    label: () => 'Zoom in',
    run: () => {
      zoomIn();
    },
  },
  [Action.ZoomOut]: {
    label: () => 'Zoom out',
    run: () => {
      zoomOut();
    },
  },
  [Action.ZoomToSelection]: {
    label: () => 'Zoom to selection',
    run: () => {
      zoomToSelection();
    },
  },
  [Action.ZoomToFit]: {
    label: () => 'Zoom to fit',
    run: () => {
      zoomToFit();
    },
  },
  [Action.ZoomTo50]: {
    label: () => 'Zoom to 50%',
    run: () => {
      zoomInOut(0.5);
    },
  },
  [Action.ZoomTo100]: {
    label: () => 'Zoom to 100%',
    run: () => {
      zoomInOut(1);
    },
  },
  [Action.ZoomTo200]: {
    label: () => 'Zoom to 200%',
    run: () => {
      zoomInOut(2);
    },
  },
  [Action.ZoomReset]: {
    label: () => 'Move to origin',
    run: () => zoomReset(),
  },
  [Action.GridPanMode]: {
    label: () => 'Grid pan mode',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.ShowCommandPalette]: {
    label: () => 'Show command palette',
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
    label: () => 'Toggle presentation mode',
    run: () => {
      if (!pixiAppSettings.setGridSettings) return;
      pixiAppSettings.setGridSettings((prev) => ({
        ...prev,
        presentationMode: !prev.presentationMode,
      }));
    },
  },
  [Action.CloseOverlay]: {
    label: () => 'Close overlay',
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
          showCommandPalette: false,
          showConnectionsMenu: false,
          showGoToMenu: false,
          showFeedbackMenu: false,
          showRenameFileMenu: false,
          showShareFileMenu: false,
          showSearch: false,
          showValidation: false,
        }));
      }
    },
  },
  [Action.SwitchSheetNext]: {
    label: () => 'Switch sheet next',
    run: () => {
      if (sheets.size > 1) {
        const nextSheet = sheets.getNext(sheets.sheet.order) ?? sheets.getFirst();
        sheets.current = nextSheet.id;
      }
    },
  },
  [Action.SwitchSheetPrevious]: {
    label: () => 'Switch sheet previous',
    run: () => {
      if (sheets.size > 1) {
        const previousSheet = sheets.getPrevious(sheets.sheet.order) ?? sheets.getLast();
        sheets.current = previousSheet.id;
      }
    },
  },
  [Action.PageUp]: {
    label: () => 'Page up',
    run: () => pageUpDown(true),
  },
  [Action.PageDown]: {
    label: () => 'Page down',
    run: () => pageUpDown(false),
  },
  [Action.ShowGoToMenu]: {
    label: () => 'Go to',
    Icon: GoToIcon,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showGoToMenu: true }));
    },
  },
  [Action.ShowCellTypeMenu]: {
    label: () => 'Code editor',
    Icon: CodeIcon,
    run: () => openCodeEditor(),
  },
  [Action.ToggleAIAnalyst]: {
    label: () => 'New chat',
    run: () => {
      toggleShowAIAnalyst();
    },
  },
  [Action.AddReferenceToAIAnalyst]: {
    label: () => 'Reference in chat',
    Icon: MentionIcon,
    run: (reference: ViewActionArgs[Action.AddReferenceToAIAnalyst]) => {
      trackEvent('[AIMentions].addReferenceFromGrid', {
        showAIAnalyst: getShowAIAnalyst(),
      });

      // Note: if we we emit `aiAnalystAddReference` immediately, the event
      // listener will not be set up yet inside the Analyst because its not
      // rendered yet. So if it's closed, we have to wait for it to be ready.
      const emitReferenceEvent = () => {
        events.emit('aiAnalystAddReference', reference ?? '');
      };
      if (getShowAIAnalyst()) {
        // AIAnalyst is already shown, emit immediately
        emitReferenceEvent();
      } else {
        // AIAnalyst needs to be shown first, wait for it to be ready
        setShowAIAnalyst(true);
        const handleReady = () => {
          events.off('aiAnalystReady', handleReady);
          emitReferenceEvent();
        };
        events.on('aiAnalystReady', handleReady);
      }

      pixiAppSettings.setContextMenu?.({});
    },
  },
};
