import { hasPermissionToEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import {
  codeEditorCellLocationAtom,
  codeEditorCellsAccessedAtom,
  codeEditorCodeStringAtom,
  codeEditorConsoleOutputAtom,
  codeEditorEditorContentAtom,
  codeEditorEvaluationResultAtom,
  codeEditorModifiedEditorContentAtom,
  codeEditorShowDiffEditorAtom,
  codeEditorShowSaveChangesAlertAtom,
  codeEditorSpillErrorAtom,
  codeEditorUnsavedChangesAtom,
} from '@/app/atoms/codeEditorAtom';
import {
  editorInteractionStateAtom,
  editorInteractionStateEditorEscapePressedAtom,
  editorInteractionStateModeAtom,
  editorInteractionStatePermissionsAtom,
  editorInteractionStateWaitingForEditorCloseAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { useConnectionState } from '@/app/atoms/useConnectionState';
import { useJavascriptState } from '@/app/atoms/useJavascriptState';
import { usePythonState } from '@/app/atoms/usePythonState';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { Coordinate } from '@/app/gridGL/types/size';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import { CodeCellLanguage, JsCodeCell, Pos } from '@/app/quadratic-core-types';
import { dispatchEditorAction } from '@/app/ui/menus/CodeEditor/CodeEditor';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { googleAnalyticsAvailable } from '@/shared/utils/analytics';
import mixpanel from 'mixpanel-browser';
import * as monaco from 'monaco-editor';
import { useCallback, useMemo } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

export const useCodeEditor = ({ editorInst }: { editorInst: monaco.editor.IStandaloneCodeEditor | null }) => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  const [editorMode, setEditorMode] = useRecoilState(editorInteractionStateModeAtom);
  const mode = useMemo(() => getLanguage(editorMode), [editorMode]);

  const editorEscapePressed = useRecoilValue(editorInteractionStateEditorEscapePressedAtom);
  const waitingForEditorClose = useRecoilValue(editorInteractionStateWaitingForEditorCloseAtom);
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);

  const [cellLocation, setCellLocation] = useRecoilState(codeEditorCellLocationAtom);
  const setCodeString = useSetRecoilState(codeEditorCodeStringAtom);
  const [editorContent, setEditorContent] = useRecoilState(codeEditorEditorContentAtom);
  const setModifiedEditorContent = useSetRecoilState(codeEditorModifiedEditorContentAtom);
  const setEvaluationResult = useSetRecoilState(codeEditorEvaluationResultAtom);
  const setConsoleOutput = useSetRecoilState(codeEditorConsoleOutputAtom);
  const setSpillError = useSetRecoilState(codeEditorSpillErrorAtom);
  const setShowSaveChangesAlert = useSetRecoilState(codeEditorShowSaveChangesAlertAtom);
  const setCellsAccessed = useSetRecoilState(codeEditorCellsAccessedAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);
  const showDiffEditor = useRecoilValue(codeEditorShowDiffEditorAtom);

  const { pythonState } = usePythonState();
  const javascriptState = useJavascriptState();
  const connectionState = useConnectionState();

  const updateCodeEditor = useCallback(
    async (sheetId: string, pos: Coordinate, pushCodeCell?: JsCodeCell, initialCode?: string) => {
      if (!sheetId) return;
      const codeCell = pushCodeCell ?? (await quadraticCore.getCodeCell(sheetId, pos.x, pos.y));

      if (codeCell) {
        setCellLocation({ sheetId, x: pos.x, y: pos.y });
        setCodeString(codeCell.code_string);
        setEditorContent(initialCode ?? codeCell.code_string);
        const newEvaluationResult = codeCell.evaluation_result ? JSON.parse(codeCell.evaluation_result) : {};
        setEvaluationResult({ ...newEvaluationResult, ...codeCell.return_info });
        setCellsAccessed(codeCell.cells_accessed);
        setConsoleOutput({ stdOut: codeCell.std_out ?? undefined, stdErr: codeCell.std_err ?? undefined });
        setSpillError(codeCell.spill_error?.map((c: Pos) => ({ x: Number(c.x), y: Number(c.y) } as Coordinate)));
        setEditorMode(codeCell.language);
      } else {
        setCodeString('');
        setEditorContent(initialCode ?? '');
        setEvaluationResult(undefined);
        setCellsAccessed(undefined);
        setConsoleOutput(undefined);
        setSpillError(undefined);
      }
    },
    [
      setCellLocation,
      setCellsAccessed,
      setCodeString,
      setConsoleOutput,
      setEditorContent,
      setEditorMode,
      setEvaluationResult,
      setSpillError,
    ]
  );

  const closeEditor = useCallback(
    (skipSaveCheck: boolean) => {
      if (showDiffEditor) {
        setModifiedEditorContent(undefined);
      } else if (!skipSaveCheck && unsavedChanges) {
        setShowSaveChangesAlert(true);
      } else {
        setEditorInteractionState((prev) => ({
          ...prev,
          editorEscapePressed: false,
          showCodeEditor: false,
          initialCode: undefined,
        }));
        pixiApp.cellHighlights.clear();
        multiplayer.sendEndCellEdit();
        setCodeString(undefined);
        setEditorContent(undefined);
        setModifiedEditorContent(undefined);
        editorInst?.dispose();
      }
    },
    [
      editorInst,
      setCodeString,
      setEditorContent,
      setEditorInteractionState,
      setModifiedEditorContent,
      setShowSaveChangesAlert,
      showDiffEditor,
      unsavedChanges,
    ]
  );

  const saveAndRunCell = useCallback(async () => {
    if (cellLocation === undefined) throw new Error(`cellLocation is undefined in CodeEditor#saveAndRunCell`);
    if (editorMode === undefined) throw new Error(`Language ${editorMode} not supported in CodeEditor#saveAndRunCell`);

    quadraticCore.setCodeCellValue({
      sheetId: cellLocation.sheetId,
      x: cellLocation.x,
      y: cellLocation.y,
      codeString: editorContent ?? '',
      language: editorMode,
      cursor: sheets.getCursorPosition(),
    });

    setCodeString(editorContent ?? '');

    mixpanel.track('[CodeEditor].cellRun', {
      type: mode,
    });

    // Google Ads Conversion for running a cell
    if (googleAnalyticsAvailable()) {
      //@ts-expect-error
      gtag('event', 'conversion', {
        send_to: 'AW-11007319783/C-yfCJOe6JkZEOe92YAp',
      });
    }
  }, [cellLocation, editorContent, editorMode, mode, setCodeString]);

  const cancelRun = useCallback(() => {
    if (mode === 'Python') {
      if (pythonState === 'running') {
        pythonWebWorker.cancelExecution();
      }
    } else if (mode === 'Javascript') {
      if (javascriptState === 'running') {
        javascriptWebWorker.cancelExecution();
      }
    } else if (mode === 'Connection') {
      if (connectionState === 'running') {
        const language: CodeCellLanguage = { Connection: {} as any };
        quadraticCore.sendCancelExecution(language);
      }
    }
  }, [connectionState, javascriptState, mode, pythonState]);

  const onKeyDownEditor = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Command + Plus
      if (matchShortcut(Action.ZoomIn, event)) {
        event.preventDefault();
        event.stopPropagation();
        dispatchEditorAction('editor.action.fontZoomIn');
      }

      // Command + Minus
      if (matchShortcut(Action.ZoomOut, event)) {
        event.preventDefault();
        event.stopPropagation();
        dispatchEditorAction('editor.action.fontZoomOut');
      }

      // Command + 0
      if (matchShortcut(Action.ZoomTo100, event)) {
        event.preventDefault();
        event.stopPropagation();
        dispatchEditorAction('editor.action.fontZoomReset');
      }

      // Don't allow the shortcuts below for certain users
      if (!hasPermissionToEditFile(permissions)) {
        return;
      }

      // Command + S
      if (matchShortcut(Action.Save, event)) {
        event.preventDefault();
        saveAndRunCell();
      }

      // Command + Enter
      if (matchShortcut(Action.ExecuteCode, event)) {
        event.preventDefault();
        event.stopPropagation();
        saveAndRunCell();
      }

      // Command + Escape
      if (matchShortcut(Action.CancelExecution, event)) {
        event.preventDefault();
        event.stopPropagation();
        cancelRun();
      }
    },
    [cancelRun, permissions, saveAndRunCell]
  );

  const afterDialog = useCallback(() => {
    setShowSaveChangesAlert(false);
    if (editorEscapePressed) {
      closeEditor(true);
    }
    if (waitingForEditorClose) {
      setEditorInteractionState((oldState) => ({
        ...oldState,
        selectedCell: waitingForEditorClose.selectedCell,
        selectedCellSheet: waitingForEditorClose.selectedCellSheet,
        mode: waitingForEditorClose.mode,
        showCodeEditor: !waitingForEditorClose.showCellTypeMenu && !waitingForEditorClose.inlineEditor,
        showCellTypeMenu: waitingForEditorClose.showCellTypeMenu,
        initialCode: waitingForEditorClose.initialCode,
        waitingForEditorClose: undefined,
      }));
      if (waitingForEditorClose.inlineEditor) {
        pixiAppSettings.changeInput(true);
      }
    } else {
      closeEditor(true);
    }
  }, [closeEditor, editorEscapePressed, setEditorInteractionState, setShowSaveChangesAlert, waitingForEditorClose]);

  return { onKeyDownEditor, afterDialog, cancelRun, closeEditor, saveAndRunCell, updateCodeEditor };
};
