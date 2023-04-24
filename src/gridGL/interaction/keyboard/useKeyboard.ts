import React, { useCallback, useContext, useEffect } from 'react';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { Size } from '../../types/size';
import { keyboardClipboard } from './keyboardClipboard';
import { keyboardSelect } from './keyboardSelect';
import { keyboardPosition } from './keyboardPosition';
import { keyboardCell } from './keyboardCell';
import { PixiApp } from '../../pixiApp/PixiApp';
import { keyboardViewport } from './keyboardViewport';
import { SheetController } from '../../../grid/controller/sheetController';
import { keyboardUndoRedo } from './keyboardUndoRedo';
import { useFormatCells } from '../../../ui/menus/TopBar/SubMenus/useFormatCells';
import { useGetSelection } from '../../../ui/menus/TopBar/SubMenus/useGetSelection';
import { useClearAllFormatting } from '../../../ui/menus/TopBar/SubMenus/useClearAllFormatting';
import { useGridSettings } from '../../../ui/menus/TopBar/SubMenus/useGridSettings';
import { UseSnackBar } from '../../../ui/components/SnackBar';
import { LocalFilesContext } from '../../../ui/QuadraticUIContext';

interface IProps {
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  editorInteractionState: EditorInteractionState;
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>;
  app: PixiApp;
  sheetController: SheetController;
  snackbar: UseSnackBar;
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
  const { format } = useGetSelection(sheetController.sheet);
  const { changeBold, changeItalic } = useFormatCells(sheetController, app);
  const { clearAllFormatting } = useClearAllFormatting(sheetController, app);
  const { presentationMode, setPresentationMode } = useGridSettings();
  const { currentFileId } = useContext(LocalFilesContext);

  const keyDownWindow = useCallback(
    (event: KeyboardEvent): void => {
      if (interactionState.showInput) return;

      if (
        keyboardViewport({
          event,
          interactionState,
          editorInteractionState,
          setEditorInteractionState,
          viewport: app?.viewport,
          sheet: sheetController.sheet,
          clearAllFormatting,
          changeBold,
          changeItalic,
          format,
          pointer: app.pointer,
          presentationMode,
          setPresentationMode,
          app,
          currentFileId,
        })
      ) {
        event.stopPropagation();
        event.preventDefault();
      }
    },
    [
      currentFileId,
      interactionState,
      editorInteractionState,
      setEditorInteractionState,
      app,
      sheetController.sheet,
      clearAllFormatting,
      changeBold,
      changeItalic,
      format,
      presentationMode,
      setPresentationMode,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', keyDownWindow);
    return () => window.removeEventListener('keydown', keyDownWindow);
  }, [keyDownWindow]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (interactionState.showInput) return;

    if (
      keyboardClipboard({
        event,
        interactionState,
        sheet_controller: props.sheetController,
        app: props.app,
        snackbar: props.snackbar,
      }) ||
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

    if (keyboardPosition({ event, interactionState, setInteractionState, sheet: sheetController.sheet })) return;

    // Prevent these commands if "command" key is being pressed
    if (event.metaKey || event.ctrlKey) {
      return;
    }

    if (
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
