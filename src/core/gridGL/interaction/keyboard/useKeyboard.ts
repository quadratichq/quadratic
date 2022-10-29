import React, { useCallback, useEffect } from 'react';
import { GridInteractionState } from '../../../../atoms/gridInteractionStateAtom';
import { EditorInteractionState } from '../../../../atoms/editorInteractionStateAtom';
import { Size } from '../../types/size';
import { keyboardClipboard } from './keyboardClipboard';
import { keyboardSelect } from './keyboardSelect';
import { keyboardPosition } from './keyboardPosition';
import { keyboardCell } from './keyboardCell';
import { PixiApp } from '../../pixiApp/PixiApp';
import { keyboardViewport } from './keyboardViewport';

interface IProps {
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
  app?: PixiApp;
}

export const pixiKeyboardCanvasProps: { headerSize: Size } = { headerSize: { width: 0, height: 0 } };

export const useKeyboard = (
  props: IProps
): { onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void; } => {
  const { interactionState, setInteractionState, setEditorInteractionState, app } = props;

  const keyDownWindow = useCallback((event: KeyboardEvent): void => {
    if (keyboardViewport({ event, viewport: app?.viewport })) {
      event.stopPropagation();
      event.preventDefault();
    }
  }, [app?.viewport]);

  useEffect(() => {
    window.addEventListener('keydown', keyDownWindow);
    return () => window.removeEventListener('keydown', keyDownWindow);
  }, [keyDownWindow]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (
      keyboardClipboard(event, interactionState) ||
      keyboardSelect({ event, interactionState, setInteractionState, viewport: app?.viewport })
    )
      return;

    // Prevent these commands if "command" key is being pressed
    if (event.metaKey || event.ctrlKey) {
      return;
    }

    if (
      keyboardPosition({ event, interactionState, setInteractionState, app }) ||
      keyboardCell({ event, interactionState, setInteractionState, setEditorInteractionState, app })
    )
      return;
  };

  return {
    onKeyDown,
  };
};
