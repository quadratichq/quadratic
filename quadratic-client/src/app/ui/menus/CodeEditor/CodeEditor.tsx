import { hasPermissionToEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import {
  codeEditorCodeStringAtom,
  codeEditorConsoleOutputAtom,
  codeEditorEditorContentAtom,
  codeEditorEvaluationResultAtom,
  codeEditorPanelBottomActiveTabAtom,
  codeEditorSpillErrorAtom,
} from '@/app/atoms/codeEditorAtom';
import {
  editorInteractionStateAtom,
  editorInteractionStateEditorEscapePressedAtom,
  editorInteractionStateInitialCodeAtom,
  editorInteractionStateModeAtom,
  editorInteractionStatePermissionsAtom,
  editorInteractionStateSelectedCellAtom,
  editorInteractionStateSelectedCellSheetAtom,
  editorInteractionStateShowCodeEditorAtom,
  editorInteractionStateWaitingForEditorCloseAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { useConnectionState } from '@/app/atoms/useConnectionState';
import { useJavascriptState } from '@/app/atoms/useJavascriptState';
import { usePythonState } from '@/app/atoms/usePythonState';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { Coordinate, SheetPosTS } from '@/app/gridGL/types/size';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { CodeCellLanguage, JsCodeCell, JsRenderCodeCell, Pos, SheetRect } from '@/app/quadratic-core-types';
import { CodeEditorBody } from '@/app/ui/menus/CodeEditor/CodeEditorBody';
import { CodeEditorEmptyState } from '@/app/ui/menus/CodeEditor/CodeEditorEmptyState';
import { CodeEditorHeader } from '@/app/ui/menus/CodeEditor/CodeEditorHeader';
import { CodeEditorPanel } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanel';
import { CodeEditorPanels } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelsResize';
import { useCodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { ReturnTypeInspector } from '@/app/ui/menus/CodeEditor/ReturnTypeInspector';
import { SaveChangesAlert } from '@/app/ui/menus/CodeEditor/SaveChangesAlert';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { cn } from '@/shared/shadcn/utils';
import { googleAnalyticsAvailable } from '@/shared/utils/analytics';
import mixpanel from 'mixpanel-browser';
import * as monaco from 'monaco-editor';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import './CodeEditor.css';
// TODO(ddimaria): leave this as we're looking to add this back in once improved
// import { Diagnostic } from 'vscode-languageserver-types';

export const dispatchEditorAction = (name: string) => {
  window.dispatchEvent(new CustomEvent('run-editor-action', { detail: name }));
};

export interface ConsoleOutput {
  stdOut?: string;
  stdErr?: string;
}

export const CodeEditor = () => {
  const showCodeEditor = useRecoilValue(editorInteractionStateShowCodeEditorAtom);
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const selectedCellSheet = useRecoilValue(editorInteractionStateSelectedCellSheetAtom);
  const selectedCell = useRecoilValue(editorInteractionStateSelectedCellAtom);
  const initialCode = useRecoilValue(editorInteractionStateInitialCodeAtom);
  const editorMode = useRecoilValue(editorInteractionStateModeAtom);
  const mode = useMemo(() => getLanguage(editorMode), [editorMode]);
  const editorEscapePressed = useRecoilValue(editorInteractionStateEditorEscapePressedAtom);
  const waitingForEditorClose = useRecoilValue(editorInteractionStateWaitingForEditorCloseAtom);
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  const [codeString, setCodeString] = useRecoilState(codeEditorCodeStringAtom);
  const [evaluationResult, setEvaluationResult] = useRecoilState(codeEditorEvaluationResultAtom);
  const setConsoleOutput = useSetRecoilState(codeEditorConsoleOutputAtom);
  const setSpillError = useSetRecoilState(codeEditorSpillErrorAtom);
  const setPanelBottomActiveTab = useSetRecoilState(codeEditorPanelBottomActiveTabAtom);
  const [editorContent, setEditorContent] = useRecoilState(codeEditorEditorContentAtom);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const { pythonState } = usePythonState();
  const javascriptState = useJavascriptState();
  const connectionState = useConnectionState();

  const [cellsAccessed, setCellsAccessed] = useState<SheetRect[] | undefined | null>();
  const [showSaveChangesAlert, setShowSaveChangesAlert] = useState(false);
  // TODO(ddimaria): leave this as we're looking to add this back in once improved
  // const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);

  // Trigger vanilla changes to code editor
  useEffect(() => {
    events.emit('codeEditor');
    setPanelBottomActiveTab(mode === 'Connection' ? 'data-browser' : 'console');
  }, [showCodeEditor, selectedCell.x, selectedCell.y, mode, setPanelBottomActiveTab]);

  const cellLocation: SheetPosTS = useMemo(() => {
    return {
      x: selectedCell.x,
      y: selectedCell.y,
      sheetId: selectedCellSheet,
    };
  }, [selectedCell.x, selectedCell.y, selectedCellSheet]);

  const unsaved = useMemo(() => {
    const unsaved = editorContent !== codeString;

    // we use the for keyboardCell so we know whether we can delete a cell with
    // the code editor open
    pixiAppSettings.unsavedEditorChanges = unsaved ? editorContent : undefined;

    return unsaved;
  }, [codeString, editorContent]);

  // handle someone trying to open a different code editor
  useEffect(() => {
    if (waitingForEditorClose) {
      // if unsaved then show save dialog and wait for that to complete
      if (unsaved) {
        setShowSaveChangesAlert(true);
      }

      // otherwise either open the new editor or show the cell type menu (if type is not selected)
      else {
        if (waitingForEditorClose) {
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
              selectedCell: waitingForEditorClose.selectedCell,
              selectedCellSheet: waitingForEditorClose.selectedCellSheet,
              mode: waitingForEditorClose.mode,
              showCodeEditor: !waitingForEditorClose.showCellTypeMenu && !waitingForEditorClose.inlineEditor,
              showCellTypeMenu: waitingForEditorClose.showCellTypeMenu,
              waitingForEditorClose: undefined,
              initialCode: waitingForEditorClose.initialCode,
            }));
          }
        }
      }
    }
  }, [setEditorInteractionState, unsaved, waitingForEditorClose]);

  // ensure codeCell is created w/content and updated when it receives a change request from Rust
  useEffect(() => {
    const updateCodeCell = async (pushCodeCell?: JsCodeCell) => {
      // selectedCellSheet may be undefined if code editor was activated from within the CellInput
      if (!selectedCellSheet) return;
      const codeCell =
        pushCodeCell ?? (await quadraticCore.getCodeCell(selectedCellSheet, selectedCell.x, selectedCell.y));

      if (codeCell) {
        setCodeString(codeCell.code_string);
        setCellsAccessed(codeCell.cells_accessed);
        setConsoleOutput({ stdOut: codeCell.std_out ?? undefined, stdErr: codeCell.std_err ?? undefined });
        if (!pushCodeCell) setEditorContent(initialCode ?? codeCell.code_string);
        const newEvaluationResult = codeCell.evaluation_result ? JSON.parse(codeCell.evaluation_result) : {};
        setEvaluationResult({ ...newEvaluationResult, ...codeCell.return_info });
        setSpillError(codeCell.spill_error?.map((c: Pos) => ({ x: Number(c.x), y: Number(c.y) } as Coordinate)));
      } else {
        setCodeString('');
        if (!pushCodeCell) {
          setEditorContent(initialCode ?? '');
        }
        setEvaluationResult(undefined);
        setConsoleOutput(undefined);
      }
    };

    updateCodeCell();

    const update = (options: {
      sheetId: string;
      x: number;
      y: number;
      codeCell?: JsCodeCell;
      renderCodeCell?: JsRenderCodeCell;
    }) => {
      if (options.sheetId === cellLocation.sheetId && options.x === cellLocation.x && options.y === cellLocation.y) {
        updateCodeCell(options.codeCell);
      }
    };

    events.on('updateCodeCell', update);

    return () => {
      events.off('updateCodeCell', update);
    };
  }, [
    cellLocation.sheetId,
    cellLocation.x,
    cellLocation.y,
    initialCode,
    selectedCell.x,
    selectedCell.y,
    selectedCellSheet,
    setCodeString,
    setConsoleOutput,
    setEditorContent,
    setEvaluationResult,
    setSpillError,
  ]);

  // TODO(ddimaria): leave this as we're looking to add this back in once improved
  // useEffect(() => {
  //   const updateDiagnostics = (e: Event) => setDiagnostics((e as CustomEvent).detail.diagnostics);
  //   window.addEventListener('python-diagnostics', updateDiagnostics);
  //   return () => {
  //     window.removeEventListener('python-diagnostics', updateDiagnostics);
  //   };
  // }, [updateCodeCell]);

  useEffect(() => {
    mixpanel.track('[CodeEditor].opened', { type: editorMode });
    multiplayer.sendCellEdit({ text: '', cursor: 0, codeEditor: true, inlineCodeEditor: false });
  }, [editorMode]);

  const closeEditor = useCallback(
    (skipSaveCheck: boolean) => {
      if (!skipSaveCheck && unsaved) {
        setShowSaveChangesAlert(true);
      } else {
        setEditorInteractionState((oldState) => ({
          ...oldState,
          editorEscapePressed: false,
          showCodeEditor: false,
          initialCode: undefined,
        }));
        pixiApp.cellHighlights.clear();
        multiplayer.sendEndCellEdit();
      }
    },
    [setEditorInteractionState, unsaved]
  );

  // handle when escape is pressed when escape does not have focus
  useEffect(() => {
    if (editorEscapePressed) {
      if (unsaved) {
        setShowSaveChangesAlert(true);
      } else {
        closeEditor(true);
      }
    }
  }, [closeEditor, editorEscapePressed, unsaved]);

  const saveAndRunCell = useCallback(async () => {
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
  }, [cellLocation.sheetId, cellLocation.x, cellLocation.y, editorContent, editorMode, mode, setCodeString]);

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
        waitingForEditorClose: undefined,
        initialCode: waitingForEditorClose.initialCode,
      }));
      if (waitingForEditorClose.inlineEditor) {
        pixiAppSettings.changeInput(true);
      }
    } else {
      closeEditor(true);
    }
  }, [closeEditor, editorEscapePressed, setEditorInteractionState, waitingForEditorClose]);

  const codeEditorPanelData = useCodeEditorPanelData();

  const codeEditorRef = useRef<HTMLDivElement | null>(null);

  if (!showCodeEditor) {
    return null;
  }

  return (
    <div
      ref={codeEditorRef}
      className={cn(
        'relative flex h-full bg-background',
        codeEditorPanelData.panelPosition === 'left' ? '' : 'flex-col'
      )}
      style={{
        width: `${
          codeEditorPanelData.editorWidth +
          (codeEditorPanelData.panelPosition === 'left' ? codeEditorPanelData.panelWidth : 0)
        }px`,
        borderLeft: '1px solid black',
      }}
    >
      <div
        id="QuadraticCodeEditorID"
        className={cn(
          'flex min-h-0 shrink select-none flex-col',
          codeEditorPanelData.panelPosition === 'left' ? 'order-2' : 'order-1'
        )}
        style={{
          width: `${codeEditorPanelData.editorWidth}px`,
          height:
            codeEditorPanelData.panelPosition === 'left' || codeEditorPanelData.bottomHidden
              ? '100%'
              : `${codeEditorPanelData.editorHeightPercentage}%`,
        }}
        onKeyDownCapture={onKeyDownEditor}
        onPointerEnter={() => {
          // todo: handle multiplayer code editor here
          multiplayer.sendMouseMove();
        }}
      >
        {showSaveChangesAlert && (
          <SaveChangesAlert
            onCancel={() => {
              setShowSaveChangesAlert(!showSaveChangesAlert);
              setEditorInteractionState((old) => ({
                ...old,
                editorEscapePressed: false,
                waitingForEditorClose: undefined,
              }));
            }}
            onSave={() => {
              saveAndRunCell();
              afterDialog();
            }}
            onDiscard={() => {
              afterDialog();
            }}
          />
        )}

        <CodeEditorHeader
          cellLocation={cellLocation}
          unsaved={unsaved}
          saveAndRunCell={saveAndRunCell}
          cancelRun={cancelRun}
          closeEditor={() => closeEditor(false)}
          editorRef={editorRef}
        />
        <CodeEditorBody
          closeEditor={closeEditor}
          cellsAccessed={!unsaved ? cellsAccessed : []}
          cellLocation={cellLocation}
          editorRef={editorRef}
        />
        <CodeEditorEmptyState editorRef={editorRef} />
        {editorMode !== 'Formula' && editorContent && (
          <ReturnTypeInspector language={editorMode} evaluationResult={evaluationResult} unsaved={unsaved} />
        )}
      </div>

      <div
        className={cn(
          codeEditorPanelData.panelPosition === 'left' ? 'order-1' : 'order-2',
          'relative flex flex-col bg-background'
        )}
        style={{
          width: codeEditorPanelData.panelPosition === 'left' ? `${codeEditorPanelData.panelWidth}px` : '100%',
          height:
            codeEditorPanelData.panelPosition === 'left'
              ? '100%'
              : codeEditorPanelData.bottomHidden
              ? 'auto'
              : 100 - codeEditorPanelData.editorHeightPercentage + '%',
        }}
      >
        <CodeEditorPanel editorRef={editorRef} codeEditorRef={codeEditorRef} />
      </div>
      <CodeEditorPanels codeEditorRef={codeEditorRef} />
    </div>
  );
};
