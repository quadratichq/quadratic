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
import { SheetController } from '../../../transaction/sheetController';
import { keyboardUndoRedo } from './keyboardUndoRedo';
import { useBorders } from '../../../../ui/menus/TopBar/SubMenus/useBorders';
import { useFormatCells } from '../../../../ui/menus/TopBar/SubMenus/useFormatCells';

interface IProps {
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
  app?: PixiApp;
  sheetController: SheetController;
}

export const pixiKeyboardCanvasProps: { headerSize: Size } = { headerSize: { width: 0, height: 0 } };

export const useKeyboard = (props: IProps): { onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void } => {
  const {
    interactionState,
    setInteractionState,
    editorInteractionState,
    setEditorInteractionState,
    app,
    sheetController,
  } = props;
  const { clearFormatting } = useFormatCells(sheetController, app);
  // @ts-expect-error
  const { clearBorders } = useBorders(sheetController.sheet, app);
  const clearAllFormatting = useCallback(() => {
    clearFormatting();
    clearBorders();
  }, [clearBorders, clearFormatting]);

  const keyDownWindow = useCallback(
    (event: KeyboardEvent): void => {
      if (interactionState.showInput) return;

      if (
        keyboardViewport({
          event,
          editorInteractionState,
          setEditorInteractionState,
          viewport: app?.viewport,
          sheet: sheetController.sheet,
          clearAllFormatting,
        })
      ) {
        event.stopPropagation();
        event.preventDefault();
      }
    },
    [
      app?.viewport,
      interactionState,
      sheetController.sheet,
      editorInteractionState,
      setEditorInteractionState,
      clearAllFormatting,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', keyDownWindow);
    return () => window.removeEventListener('keydown', keyDownWindow);
  }, [keyDownWindow]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (interactionState.showInput) return;

    if (
      keyboardClipboard(event, interactionState, props.sheetController) ||
      keyboardUndoRedo(event, interactionState, props.sheetController) ||
      keyboardSelect({
        event,
        interactionState,
        setInteractionState,
        viewport: app?.viewport,
        sheet: props.sheetController.sheet,
      })
    )
      return;

    // Prevent these commands if "command" key is being pressed
    if (event.metaKey || event.ctrlKey) {
      return;
    }

    if (
      keyboardPosition({ event, interactionState, setInteractionState }) ||
      keyboardCell({
        sheet_controller: props.sheetController,
        event,
        interactionState,
        setInteractionState,
        editorInteractionState,
        setEditorInteractionState,
        app,
      })
    )
      return;
  };

  return {
    onKeyDown,
  };
};
