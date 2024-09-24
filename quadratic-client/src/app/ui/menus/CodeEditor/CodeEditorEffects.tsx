import {
  codeEditorAtom,
  codeEditorInitialCodeAtom,
  codeEditorLanguageAtom,
  codeEditorLocationAtom,
  codeEditorPanelBottomActiveTabAtom,
  codeEditorShowCodeEditorAtom,
  codeEditorShowSaveChangesAlertAtom,
  codeEditorUnsavedChangesAtom,
  codeEditorWaitingForEditorClose,
} from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateShowCellTypeMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { JsCodeCell, JsRenderCodeCell } from '@/app/quadratic-core-types';
import { useUpdateCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useUpdateCodeEditor';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import mixpanel from 'mixpanel-browser';
import { useEffect, useMemo } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const CodeEditorEffects = () => {
  const setShowCellTypeMenu = useSetRecoilState(editorInteractionStateShowCellTypeMenuAtom);

  const showCodeEditor = useRecoilValue(codeEditorShowCodeEditorAtom);
  const location = useRecoilValue(codeEditorLocationAtom);
  const language = useRecoilValue(codeEditorLanguageAtom);
  const mode = useMemo(() => getLanguage(language), [language]);
  const initialCode = useRecoilValue(codeEditorInitialCodeAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);
  const waitingForEditorClose = useRecoilValue(codeEditorWaitingForEditorClose);
  const setPanelBottomActiveTab = useSetRecoilState(codeEditorPanelBottomActiveTabAtom);
  const setShowSaveChangesAlert = useSetRecoilState(codeEditorShowSaveChangesAlertAtom);
  const setCodeEditorState = useSetRecoilState(codeEditorAtom);

  const { updateCodeEditor } = useUpdateCodeEditor();

  // ensure codeCell is created w/content and updated when it receives a change request from Rust
  useEffect(() => {
    const update = (options: {
      sheetId: string;
      x: number;
      y: number;
      codeCell?: JsCodeCell;
      renderCodeCell?: JsRenderCodeCell;
    }) => {
      const { sheetId, x, y, codeCell } = options;
      if (showCodeEditor && sheetId === location.sheetId && x === location.pos.x && y === location.pos.y) {
        updateCodeEditor(sheetId, x, y, codeCell, undefined);
      }
    };

    events.on('updateCodeCell', update);
    return () => {
      events.off('updateCodeCell', update);
    };
  }, [location.pos.x, location.pos.y, location.sheetId, showCodeEditor, updateCodeEditor]);

  useEffect(() => {
    updateCodeEditor(location.sheetId, location.pos.x, location.pos.y, undefined, initialCode);
  }, [initialCode, location.sheetId, location.pos.x, location.pos.y, updateCodeEditor]);

  // handle someone trying to open a different code editor
  useEffect(() => {
    if (waitingForEditorClose) {
      // if unsaved then show save dialog and wait for that to complete
      if (unsavedChanges) {
        setShowSaveChangesAlert(true);
      }

      // otherwise either open the new editor or show the cell type menu (if type is not selected)
      else {
        if (waitingForEditorClose.inlineEditor) {
          pixiAppSettings.changeInput(true);
          setCodeEditorState((prev) => ({
            ...prev,
            waitingForEditorClose: undefined,
            showCodeEditor: false,
          }));
        } else {
          setShowCellTypeMenu(waitingForEditorClose.showCellTypeMenu);
          setCodeEditorState((prev) => ({
            ...prev,
            waitingForEditorClose: undefined,
            location: waitingForEditorClose.location,
            language: waitingForEditorClose.language,
            showCodeEditor: !waitingForEditorClose.showCellTypeMenu && !waitingForEditorClose.inlineEditor,
            initialCode: waitingForEditorClose.initialCode,
          }));
        }
      }
    }
  }, [setCodeEditorState, setShowCellTypeMenu, setShowSaveChangesAlert, unsavedChanges, waitingForEditorClose]);

  useEffect(() => {
    mixpanel.track('[CodeEditor].opened', { type: language });
    multiplayer.sendCellEdit({ text: '', cursor: 0, codeEditor: true, inlineCodeEditor: false });
  }, [language]);

  // Trigger vanilla changes to code editor
  useEffect(() => {
    if (showCodeEditor) {
      events.emit('codeEditor');
      setPanelBottomActiveTab(mode === 'Connection' ? 'data-browser' : 'console');
    }
  }, [location.sheetId, location.pos.x, location.pos.y, mode, showCodeEditor, setPanelBottomActiveTab]);

  return null;
};
