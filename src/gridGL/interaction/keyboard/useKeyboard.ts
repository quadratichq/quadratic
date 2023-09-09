import React, { useEffect } from 'react';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { useGlobalSnackbar } from '../../../components/GlobalSnackbar';
import { useGridSettings } from '../../../ui/menus/TopBar/SubMenus/useGridSettings';
import { pixiApp } from '../../pixiApp/PixiApp';
import { Size } from '../../types/size';
import { keyboardCell } from './keyboardCell';
import { keyboardClipboard } from './keyboardClipboard';
import { keyboardPosition } from './keyboardPosition';
import { keyboardSelect } from './keyboardSelect';
import { keyboardUndoRedo } from './keyboardUndoRedo';
import { keyboardViewport } from './keyboardViewport';

export interface IProps {
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
}

export const pixiKeyboardCanvasProps: { headerSize: Size } = { headerSize: { width: 0, height: 0 } };

export const useKeyboard = (props: IProps): { onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void } => {
  const { editorInteractionState, setEditorInteractionState } = props;
  const { presentationMode, setPresentationMode } = useGridSettings();
  const { addGlobalSnackbar } = useGlobalSnackbar();

  useEffect(() => {
    const keyDownWindow = (event: KeyboardEvent): void => {
      if (pixiApp.settings.input.show) return;

      if (
        keyboardViewport({
          event,
          editorInteractionState,
          setEditorInteractionState,
          presentationMode,
          setPresentationMode,
        })
      ) {
        event.stopPropagation();
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', keyDownWindow);
    return () => window.removeEventListener('keydown', keyDownWindow);
  }, [editorInteractionState, presentationMode, setEditorInteractionState, setPresentationMode]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (pixiApp.settings.input.show) return;

    if (
      keyboardClipboard({
        event,
        addGlobalSnackbar,
      }) ||
      keyboardUndoRedo(event) ||
      keyboardSelect(event)
    )
      return;

    if (keyboardPosition(event)) return;

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
    )
      return;
  };

  return {
    onKeyDown,
  };
};
