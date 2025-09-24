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
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import type { JsUpdateCodeCell } from '@/app/quadratic-core-types';
import { useUpdateCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useUpdateCodeEditor';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { memo, useEffect, useMemo } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const CodeEditorEffects = memo(() => {
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
    const update = (updateCodeCells: JsUpdateCodeCell[]) => {
      const updateCodeCell = updateCodeCells.find(
        (updateCodeCell) =>
          updateCodeCell.sheet_id.id === codeCell.sheetId &&
          Number(updateCodeCell.pos.x) === codeCell.pos.x &&
          Number(updateCodeCell.pos.y) === codeCell.pos.y
      );
      if (updateCodeCell) {
        quadraticCore.getCodeCell(codeCell.sheetId, codeCell.pos.x, codeCell.pos.y).then((codeCellCore) => {
          updateCodeEditor(codeCell.sheetId, codeCell.pos.x, codeCell.pos.y, codeCellCore, undefined, true);
        });
      }
    };

    events.on('updateCodeCells', update);
    return () => {
      events.off('updateCodeCells', update);
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
          content.cellHighlights.clear();
        } else {
          setShowCellTypeMenu(waitingForEditorClose.showCellTypeMenu);
          setCodeEditorState((prev) => ({
            ...prev,
            showCodeEditor: !waitingForEditorClose.showCellTypeMenu && !waitingForEditorClose.inlineEditor,
            codeCell: waitingForEditorClose.codeCell,
            initialCode: waitingForEditorClose.initialCode,
            waitingForEditorClose: undefined,
          }));
          content.cellHighlights.clear();
        }
      }
    }
  }, [setCodeEditorState, setShowCellTypeMenu, setShowSaveChangesAlert, unsavedChanges, waitingForEditorClose]);

  useEffect(() => {
    trackEvent('[CodeEditor].opened', { type: language });
    multiplayer.sendCellEdit({ text: '', cursor: 0, codeEditor: true, inlineCodeEditor: false });
  }, [language]);

  // Trigger vanilla changes to code editor
  useEffect(() => {
    if (showCodeEditor) {
      events.emit('codeEditor');
      setPanelBottomActiveTab(language === 'Connection' ? 'data-browser' : 'console');
    }
  }, [codeCell.sheetId, codeCell.pos.x, codeCell.pos.y, language, showCodeEditor, setPanelBottomActiveTab]);

  return null;
});
