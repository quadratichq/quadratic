import { Action } from '@/app/actions/actions';
import { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { keyboardCell } from '@/app/gridGL/interaction/keyboard/keyboardCell';
import { keyboardClipboard } from '@/app/gridGL/interaction/keyboard/keyboardClipboard';
import { keyboardCode } from '@/app/gridGL/interaction/keyboard/keyboardCode';
import { keyboardDropdown } from '@/app/gridGL/interaction/keyboard/keyboardDropdown';
import { keyboardLink } from '@/app/gridGL/interaction/keyboard/keyboardLink';
import { keyboardPosition } from '@/app/gridGL/interaction/keyboard/keyboardPosition';
import { keyboardSearch } from '@/app/gridGL/interaction/keyboard/keyboardSearch';
import { keyboardSelect } from '@/app/gridGL/interaction/keyboard/keyboardSelect';
import { keyboardUndoRedo } from '@/app/gridGL/interaction/keyboard/keyboardUndoRedo';
import { keyboardViewport } from '@/app/gridGL/interaction/keyboard/keyboardViewport';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { Size } from '@/app/gridGL/types/size';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import { useGridSettings } from '@/app/ui/hooks/useGridSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';

export interface IProps {
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
}

export const pixiKeyboardCanvasProps: { headerSize: Size } = { headerSize: { width: 0, height: 0 } };

export const useKeyboard = (
  props: IProps
): {
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  onKeyUp: (event: React.KeyboardEvent<HTMLElement>) => void;
} => {
  const { editorInteractionState, setEditorInteractionState } = props;
  const { presentationMode, setPresentationMode } = useGridSettings();
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (pixiAppSettings.input.show && inlineEditorHandler.isOpen()) return;
    if (
      keyboardLink(event) ||
      keyboardViewport({
        event,
        editorInteractionState,
        setEditorInteractionState,
        presentationMode,
        setPresentationMode,
      }) ||
      keyboardSearch(event, editorInteractionState, setEditorInteractionState) ||
      keyboardClipboard({
        event,
        addGlobalSnackbar,
      }) ||
      keyboardDropdown(event.nativeEvent, editorInteractionState) ||
      keyboardUndoRedo(event) ||
      keyboardSelect(event) ||
      keyboardCode(event, editorInteractionState) ||
      keyboardPosition(event.nativeEvent)
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // todo: we need to reorganize this so we can handle shortcuts in keyboardCell when ctrl or meta is pressed
    // insert today's date if the inline editor is not open
    if (matchShortcut(Action.InsertToday, event)) {
      const sheet = sheets.sheet;
      const cursor = sheet.cursor;
      const today = new Date();
      const formattedDate = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
      quadraticCore.setCellValue(sheet.id, cursor.cursorPosition.x, cursor.cursorPosition.y, formattedDate);
    }

    // Prevent these commands if "command" key is being pressed
    if (event.metaKey || event.ctrlKey) {
      return;
    }

    if (
      keyboardCell({
        event,
        editorInteractionState,
        setEditorInteractionState,
      })
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  };

  const onKeyUp = (event: React.KeyboardEvent<HTMLElement>) => {
    if (keyboardLink(event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  };

  return {
    onKeyDown,
    onKeyUp,
  };
};
