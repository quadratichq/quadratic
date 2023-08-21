import React, { useEffect } from 'react';
import { useGlobalSnackbar } from '../../../components/GlobalSnackbar';
import { useClearAllFormatting } from '../../../ui/menus/TopBar/SubMenus/useClearAllFormatting';
import { useFormatCells } from '../../../ui/menus/TopBar/SubMenus/useFormatCells';
import { useGetSelection } from '../../../ui/menus/TopBar/SubMenus/useGetSelection';
import { useGridSettings } from '../../../ui/menus/TopBar/SubMenus/useGridSettings';
import { keyboardViewport } from './keyboardViewport';
import { IProps } from './useKeyboard';

export const useKeyboard = (props: IProps): { onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void } => {
    const { editorInteractionState, setEditorInteractionState, app, sheetController } = props;
    const { formatPrimaryCell } = useGetSelection(sheetController.sheet);
    const { setBold: changeBold, setItalic: changeItalic } = useFormatCells(sheetController);
    const { clearAllFormatting } = useClearAllFormatting(sheetController);
    const { presentationMode, setPresentationMode } = useGridSettings();
    const { addGlobalSnackbar } = useGlobalSnackbar();

    useEffect(() => {
      const keyDownWindow = (event: KeyboardEvent): void => {
          if (app.settings.input.show) return;

          if (
            keyboardViewport({
              event,
              editorInteractionState,
              setEditorInteractionState,
              sheet: sheetController.sheet,
              clearAllFormatting,
              changeBold,
              changeItalic,
              formatPrimaryCell,
              pointer: app.pointer,
              presentationMode,
              setPresentationMode,
              app,
            })
          ) {
            event.stopPropagation();
            event.preventDefault();
          }
        },
        [
          interactionState,
          editorInteractionState,
          setEditorInteractionState,
          app,
          sheetController,
          sheet,
          clearAllFormatting,
          changeBold,
          changeItalic,
          format,
          presentationMode,
          setPresentationMode,
        ];
    });

    window.addEventListener('keydown', keyDownWindow);
    return () => window.removeEventListener('keydown', keyDownWindow);
  },
  [
    app,
    changeBold,
    changeItalic,
    clearAllFormatting,
    currentFileId,
    editorInteractionState,
    formatPrimaryCell,
    presentationMode,
    setEditorInteractionState,
    setPresentationMode,
    sheetController,
    sheet,
  ];
