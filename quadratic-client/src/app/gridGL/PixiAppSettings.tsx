import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { gridSettingsAtom } from '@/app/atoms/gridSettingsAtom';
import { inlineEditorAtom } from '@/app/atoms/inlineEditorAtom';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { useEffect } from 'react';
import { useRecoilState } from 'recoil';

// handles updating the pixiAppSettings
export const PixiAppSettings = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const [inlineEditorState, setInlineEditorState] = useRecoilState(inlineEditorAtom);
  const [codeEditorState, setCodeEditorState] = useRecoilState(codeEditorAtom);
  useEffect(() => {
    pixiAppSettings.updateEditorInteractionState(editorInteractionState, setEditorInteractionState);
    pixiAppSettings.updateInlineEditorState(inlineEditorState, setInlineEditorState);
    pixiAppSettings.updateCodeEditorState(codeEditorState, setCodeEditorState);
  }, [
    codeEditorState,
    editorInteractionState,
    inlineEditorState,
    setCodeEditorState,
    setEditorInteractionState,
    setInlineEditorState,
  ]);

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
