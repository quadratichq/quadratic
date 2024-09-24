import {
  codeEditorCellLocationAtom,
  codeEditorLoadingAtom,
  codeEditorPanelBottomActiveTabAtom,
  codeEditorShowSaveChangesAlertAtom,
  codeEditorUnsavedChangesAtom,
} from '@/app/atoms/codeEditorAtom';
import {
  editorInteractionStateAtom,
  editorInteractionStateInitialCodeAtom,
  editorInteractionStateModeAtom,
  editorInteractionStateSelectedCellAtom,
  editorInteractionStateSelectedCellSheetAtom,
  editorInteractionStateShowCodeEditorAtom,
  editorInteractionStateWaitingForEditorCloseAtom,
} from '@/app/atoms/editorInteractionStateAtom';
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
  const showCodeEditor = useRecoilValue(editorInteractionStateShowCodeEditorAtom);
  const selectedCellSheet = useRecoilValue(editorInteractionStateSelectedCellSheetAtom);
  const selectedCell = useRecoilValue(editorInteractionStateSelectedCellAtom);
  const editorMode = useRecoilValue(editorInteractionStateModeAtom);
  const mode = useMemo(() => getLanguage(editorMode), [editorMode]);
  const initialCode = useRecoilValue(editorInteractionStateInitialCodeAtom);
  const waitingForEditorClose = useRecoilValue(editorInteractionStateWaitingForEditorCloseAtom);
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  const setLoading = useSetRecoilState(codeEditorLoadingAtom);
  const cellLocation = useRecoilValue(codeEditorCellLocationAtom);
  const setPanelBottomActiveTab = useSetRecoilState(codeEditorPanelBottomActiveTabAtom);
  const setShowSaveChangesAlert = useSetRecoilState(codeEditorShowSaveChangesAlertAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);

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
      if (
        showCodeEditor &&
        options.sheetId === cellLocation?.sheetId &&
        options.x === cellLocation?.x &&
        options.y === cellLocation?.y
      ) {
        updateCodeEditor(options.sheetId, { x: options.x, y: options.y }, options.codeCell, undefined);
      }
    };

    events.on('updateCodeCell', update);
    return () => {
      events.off('updateCodeCell', update);
    };
  }, [cellLocation, showCodeEditor, updateCodeEditor]);

  useEffect(() => {
    let prevLoading = false;
    setLoading((prev) => {
      prevLoading = prev;
      return true;
    });
    if (prevLoading) return;
    updateCodeEditor(selectedCellSheet, selectedCell, undefined, initialCode).then(() => setLoading(false));
  }, [initialCode, selectedCell, selectedCellSheet, setLoading, updateCodeEditor]);

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
          setEditorInteractionState((oldState) => ({
            ...oldState,
            waitingForEditorClose: undefined,
            showCodeEditor: false,
          }));
        } else {
          setEditorInteractionState((oldState) => ({
            ...oldState,
            waitingForEditorClose: undefined,
            selectedCellSheet: waitingForEditorClose.selectedCellSheet,
            selectedCell: waitingForEditorClose.selectedCell,
            mode: waitingForEditorClose.mode,
            showCodeEditor: !waitingForEditorClose.showCellTypeMenu && !waitingForEditorClose.inlineEditor,
            showCellTypeMenu: waitingForEditorClose.showCellTypeMenu,
            initialCode: waitingForEditorClose.initialCode,
          }));
        }
      }
    }
  }, [setEditorInteractionState, setShowSaveChangesAlert, unsavedChanges, waitingForEditorClose]);

  useEffect(() => {
    mixpanel.track('[CodeEditor].opened', { type: editorMode });
    multiplayer.sendCellEdit({ text: '', cursor: 0, codeEditor: true, inlineCodeEditor: false });
  }, [editorMode]);

  // Trigger vanilla changes to code editor
  useEffect(() => {
    if (showCodeEditor) {
      events.emit('codeEditor');
      setPanelBottomActiveTab(mode === 'Connection' ? 'data-browser' : 'console');
    }
  }, [cellLocation, mode, showCodeEditor, setPanelBottomActiveTab]);

  return null;
};
