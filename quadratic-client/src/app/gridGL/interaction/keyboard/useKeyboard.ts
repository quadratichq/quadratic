import { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { presentationModeAtom } from '@/app/atoms/gridSettingsAtom';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { keyboardCell } from '@/app/gridGL/interaction/keyboard/keyboardCell';
import { keyboardClipboard } from '@/app/gridGL/interaction/keyboard/keyboardClipboard';
import { keyboardCode } from '@/app/gridGL/interaction/keyboard/keyboardCode';
import { keyboardDropdown } from '@/app/gridGL/interaction/keyboard/keyboardDropdown';
import { keyboardPosition } from '@/app/gridGL/interaction/keyboard/keyboardPosition';
import { keyboardSearch } from '@/app/gridGL/interaction/keyboard/keyboardSearch';
import { keyboardSelect } from '@/app/gridGL/interaction/keyboard/keyboardSelect';
import { keyboardUndoRedo } from '@/app/gridGL/interaction/keyboard/keyboardUndoRedo';
import { keyboardViewport } from '@/app/gridGL/interaction/keyboard/keyboardViewport';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { Size } from '@/app/gridGL/types/size';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { useRecoilState } from 'recoil';

export interface IProps {
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
}

export const pixiKeyboardCanvasProps: { headerSize: Size } = { headerSize: { width: 0, height: 0 } };

export const useKeyboard = (props: IProps): { onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void } => {
  const { editorInteractionState, setEditorInteractionState } = props;
  const [presentationMode, setPresentationMode] = useRecoilState(presentationModeAtom);
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (pixiAppSettings.input.show && inlineEditorHandler.isOpen()) return;
    if (
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

  return {
    onKeyDown,
  };
};
