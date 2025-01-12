import {
  codeEditorAtom,
  codeEditorCodeCellAtom,
  codeEditorInitialCodeAtom,
  codeEditorLoadingAtom,
  codeEditorPanelBottomActiveTabAtom,
  codeEditorShowCodeEditorAtom,
  codeEditorShowSaveChangesAlertAtom,
  codeEditorUnsavedChangesAtom,
  codeEditorWaitingForEditorClose,
} from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateShowCellTypeMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import type { JsCodeCell, JsRenderCodeCell } from '@/app/quadratic-core-types';
import { useUpdateCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useUpdateCodeEditor';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import mixpanel from 'mixpanel-browser';
import { useEffect, useMemo } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const CodeEditorEffects = () => {
  const setShowCellTypeMenu = useSetRecoilState(editorInteractionStateShowCellTypeMenuAtom);

  const showCodeEditor = useRecoilValue(codeEditorShowCodeEditorAtom);
  const codeCell = useRecoilValue(codeEditorCodeCellAtom);
  const language = useMemo(() => getLanguage(codeCell.language), [codeCell.language]);
  const initialCode = useRecoilValue(codeEditorInitialCodeAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);
  const waitingForEditorClose = useRecoilValue(codeEditorWaitingForEditorClose);
  const setLoading = useSetRecoilState(codeEditorLoadingAtom);
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
      const { sheetId, x, y, codeCell: codeCellCore } = options;
      if (showCodeEditor && sheetId === codeCell.sheetId && x === codeCell.pos.x && y === codeCell.pos.y) {
        updateCodeEditor(sheetId, x, y, codeCellCore, undefined, true);
      }
    };

    events.on('updateCodeCell', update);
    return () => {
      events.off('updateCodeCell', update);
    };
  }, [codeCell.pos.x, codeCell.pos.y, codeCell.sheetId, showCodeEditor, updateCodeEditor]);

  useEffect(() => {
    if (codeCell.sheetId && initialCode !== undefined) {
      setLoading(true);
      quadraticCore.getCodeCell(codeCell.sheetId, codeCell.pos.x, codeCell.pos.y).then((codeCellCore) => {
        updateCodeEditor(codeCell.sheetId, codeCell.pos.x, codeCell.pos.y, codeCellCore, initialCode);
      });
    }
  }, [codeCell.sheetId, codeCell.pos.x, codeCell.pos.y, initialCode, setLoading, updateCodeEditor]);

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
          pixiApp.cellHighlights.clear();
        } else {
          setShowCellTypeMenu(waitingForEditorClose.showCellTypeMenu);
          setCodeEditorState((prev) => ({
            ...prev,
            showCodeEditor: !waitingForEditorClose.showCellTypeMenu && !waitingForEditorClose.inlineEditor,
            codeCell: waitingForEditorClose.codeCell,
            initialCode: waitingForEditorClose.initialCode,
            waitingForEditorClose: undefined,
          }));
          pixiApp.cellHighlights.clear();
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
      setPanelBottomActiveTab(language === 'Connection' ? 'data-browser' : 'ai-assistant');
    }
  }, [codeCell.sheetId, codeCell.pos.x, codeCell.pos.y, language, showCodeEditor, setPanelBottomActiveTab]);

  return null;
};
