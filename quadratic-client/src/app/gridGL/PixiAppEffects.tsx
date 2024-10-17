import { codeEditorAtom, codeEditorShowCodeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { contextMenuAtom } from '@/app/atoms/contextMenuAtoms';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { gridPanModeAtom } from '@/app/atoms/gridPanModeAtom';
import { gridSettingsAtom, presentationModeAtom, showHeadingsAtom } from '@/app/atoms/gridSettingsAtom';
import { inlineEditorAtom } from '@/app/atoms/inlineEditorAtom';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { useEffect } from 'react';
import { isMobile } from 'react-device-detect';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

export const PixiAppEffects = () => {
  const presentationMode = useRecoilValue(presentationModeAtom);
  const showCodeEditor = useRecoilValue(codeEditorShowCodeEditorAtom);

  // Resize the canvas when user goes in/out of presentation mode
  useEffect(() => {
    pixiApp.resize();
  }, [presentationMode, showCodeEditor]);

  const setShowHeadings = useSetRecoilState(showHeadingsAtom);
  // For mobile, set Headers to not visible by default
  useEffect(() => {
    if (isMobile) {
      setShowHeadings(false);
      pixiApp.viewportChanged();
    }
  }, [setShowHeadings]);

  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  useEffect(() => {
    pixiAppSettings.updateEditorInteractionState(editorInteractionState, setEditorInteractionState);
  }, [editorInteractionState, setEditorInteractionState]);

  const [inlineEditorState, setInlineEditorState] = useRecoilState(inlineEditorAtom);
  useEffect(() => {
    pixiAppSettings.updateInlineEditorState(inlineEditorState, setInlineEditorState);
  }, [inlineEditorState, setInlineEditorState]);

  const [codeEditorState, setCodeEditorState] = useRecoilState(codeEditorAtom);
  useEffect(() => {
    pixiAppSettings.updateCodeEditorState(codeEditorState, setCodeEditorState);
  }, [codeEditorState, setCodeEditorState]);

  const { addGlobalSnackbar } = useGlobalSnackbar();
  useEffect(() => {
    pixiAppSettings.addGlobalSnackbar = addGlobalSnackbar;
  }, [addGlobalSnackbar]);

  const [gridSettings, setGridSettings] = useRecoilState(gridSettingsAtom);
  useEffect(() => {
    pixiAppSettings.updateGridSettings(gridSettings, setGridSettings);
  }, [gridSettings, setGridSettings]);

  const [gridPanMode, setGridPanMode] = useRecoilState(gridPanModeAtom);
  useEffect(() => {
    pixiAppSettings.updateGridPanMode(gridPanMode, setGridPanMode);
  }, [gridPanMode, setGridPanMode]);

  const [contextMenu, setContextMenu] = useRecoilState(contextMenuAtom);
  useEffect(() => {
    pixiAppSettings.updateContextMenu(contextMenu, setContextMenu);
  }, [contextMenu, setContextMenu]);

  useEffect(() => {
    const handleMouseUp = () => {
      setGridPanMode((prev) => ({ ...prev, mouseIsDown: false }));
    };

    const disablePanMode = () => {
      setGridPanMode((prev) => ({ ...prev, mouseIsDown: false, spaceIsDown: false }));
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', disablePanMode);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', disablePanMode);
    };
  }, [setGridPanMode]);

  return null;
};
