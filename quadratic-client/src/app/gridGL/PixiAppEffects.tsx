import { codeEditorAtom, codeEditorShowCodeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
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

  return null;
};
