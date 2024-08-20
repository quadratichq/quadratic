import { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { Size } from '@/app/gridGL/types/size';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { useGridSettings } from '@/app/ui/menus/TopBar/SubMenus/useGridSettings';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import React, { useEffect } from 'react';
import { keyboardCell } from './keyboardCell';
import { keyboardClipboard } from './keyboardClipboard';
import { keyboardCode } from './keyboardCode';
import { keyboardPosition } from './keyboardPosition';
import { keyboardSearch } from './keyboardSearch';
import { keyboardSelect } from './keyboardSelect';
import { keyboardUndoRedo } from './keyboardUndoRedo';
import { keyboardViewport } from './keyboardViewport';
import { keyboardDropdown } from './keyboardDropdown';

export interface IProps {
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
}

export const pixiKeyboardCanvasProps: { headerSize: Size } = { headerSize: { width: 0, height: 0 } };

export const useKeyboard = (props: IProps): { onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void } => {
  const { editorInteractionState, setEditorInteractionState } = props;
  const { presentationMode, setPresentationMode } = useGridSettings();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const { name: fileName } = useFileContext();

  useEffect(() => {
    const keyDownWindow = (event: KeyboardEvent) => {
      if (pixiAppSettings.input.show || inlineEditorHandler.isOpen()) return;

      if (
        keyboardViewport({
          event,
          editorInteractionState,
          setEditorInteractionState,
          presentationMode,
          setPresentationMode,
        }) ||
        keyboardSearch(event, editorInteractionState, setEditorInteractionState)
      ) {
        event.stopPropagation();
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', keyDownWindow);
    return () => window.removeEventListener('keydown', keyDownWindow);
  }, [editorInteractionState, presentationMode, setEditorInteractionState, setPresentationMode]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (pixiAppSettings.input.show && inlineEditorHandler.isOpen()) return;
    if (
      keyboardClipboard({
        event,
        addGlobalSnackbar,
        fileName,
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
