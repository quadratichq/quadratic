import { aiAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { codeEditorAtom, codeEditorShowCodeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { contextMenuAtom } from '@/app/atoms/contextMenuAtom';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { gridPanModeAtom } from '@/app/atoms/gridPanModeAtom';
import {
  gridSettingsAtom,
  presentationModeAtom,
  restoreFileViewStateAtom,
  showHeadingsAtom,
} from '@/app/atoms/gridSettingsAtom';
import { inlineEditorAtom } from '@/app/atoms/inlineEditorAtom';
import { events } from '@/app/events/events';
import { fileViewState } from '@/app/fileViewState/fileViewState';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { memo, useEffect } from 'react';
import { isMobile } from 'react-device-detect';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

export const PixiAppEffects = memo(() => {
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

    const unsavedChanges = codeEditorState.editorContent !== codeEditorState.codeString;
    if (unsavedChanges) {
      pixiAppSettings.unsavedEditorChanges = codeEditorState.editorContent;
    } else {
      pixiAppSettings.unsavedEditorChanges = undefined;
    }
  }, [codeEditorState, setCodeEditorState]);

  const { addGlobalSnackbar, closeCurrentSnackbar } = useGlobalSnackbar();
  useEffect(() => {
    pixiAppSettings.addGlobalSnackbar = addGlobalSnackbar;
    pixiAppSettings.closeCurrentSnackbar = closeCurrentSnackbar;
  }, [addGlobalSnackbar, closeCurrentSnackbar]);

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

  const [aiAnalystState, setAIAnalystState] = useRecoilState(aiAnalystAtom);
  const { submitPrompt } = useSubmitAIAnalystPrompt();
  useEffect(() => {
    pixiAppSettings.updateAIAnalystState(aiAnalystState, setAIAnalystState, submitPrompt);
  }, [aiAnalystState, setAIAnalystState, submitPrompt]);

  useEffect(() => {
    events.emit('pixiAppSettingsInitialized');
  }, []);

  const restoreFileViewState = useRecoilValue(restoreFileViewStateAtom);

  // Start saving view state when setting is on
  useEffect(() => {
    if (!restoreFileViewState) return;
    fileViewState.startSaving();
  }, [restoreFileViewState]);

  useEffect(() => {
    const handleMouseUp = () => {
      setGridPanMode((prev) => {
        if (!prev.mouseIsDown) return prev;
        return { ...prev, mouseIsDown: false };
      });
    };

    const disablePanMode = () => {
      setGridPanMode((prev) => {
        if (!prev.mouseIsDown && !prev.spaceIsDown) return prev;
        return { ...prev, mouseIsDown: false, spaceIsDown: false };
      });
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', disablePanMode);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', disablePanMode);
    };
  }, [setGridPanMode]);

  return null;
});
