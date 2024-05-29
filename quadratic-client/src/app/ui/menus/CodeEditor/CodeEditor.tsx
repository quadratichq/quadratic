import { usePythonState } from '@/app/atoms/usePythonState';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Coordinate, SheetPosTS } from '@/app/gridGL/types/size';
import { JsCodeCell, JsRenderCodeCell, Pos, SheetRect } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import mixpanel from 'mixpanel-browser';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
// TODO(ddimaria): leave this as we're looking to add this back in once improved
// import { Diagnostic } from 'vscode-languageserver-types';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { CodeEditorPanels } from '@/app/ui/menus/CodeEditor/CodeEditorPanels';
import { useCodeEditorPanelData } from '@/app/ui/menus/CodeEditor/useCodeEditorPanelData';
import { cn } from '@/shared/shadcn/utils';
import { googleAnalyticsAvailable } from '@/shared/utils/analytics';
import { hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { pixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { focusGrid } from '../../../helpers/focusGrid';
import { pythonWebWorker } from '../../../web-workers/pythonWebWorker/pythonWebWorker';
import './CodeEditor.css';
import { CodeEditorBody } from './CodeEditorBody';
import { CodeEditorProvider } from './CodeEditorContext';
import { CodeEditorHeader } from './CodeEditorHeader';
import { Console } from './Console';
import { ReturnTypeInspector } from './ReturnTypeInspector';
import { SaveChangesAlert } from './SaveChangesAlert';

export const dispatchEditorAction = (name: string) => {
  window.dispatchEvent(new CustomEvent('run-editor-action', { detail: name }));
};

export const CodeEditor = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { showCodeEditor, mode: editorMode } = editorInteractionState;

  const { pythonState } = usePythonState();
  const containerRef = useRef<HTMLDivElement>(null);

  // update code cell
  const [codeString, setCodeString] = useState('');

  // code info
  const [out, setOut] = useState<{ stdOut?: string; stdErr?: string } | undefined>(undefined);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | undefined>(undefined);
  const [spillError, setSpillError] = useState<Coordinate[] | undefined>();
  const [cellsAccessed, setCellsAccessed] = useState<SheetRect[] | undefined | null>();

  const [showSaveChangesAlert, setShowSaveChangesAlert] = useState(false);
  const [editorContent, setEditorContent] = useState<string | undefined>(codeString);
  // TODO(ddimaria): leave this as we're looking to add this back in once improved
  // const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);

  // used to trigger vanilla changes to code editor
  useEffect(() => {
    events.emit('codeEditor');
  }, [
    showCodeEditor,
    editorInteractionState.selectedCell.x,
    editorInteractionState.selectedCell.y,
    editorInteractionState.mode,
  ]);

  const cellLocation: SheetPosTS = useMemo(() => {
    return {
      x: editorInteractionState.selectedCell.x,
      y: editorInteractionState.selectedCell.y,
      sheetId: editorInteractionState.selectedCellSheet,
    };
  }, [editorInteractionState]);

  const unsaved = useMemo(() => {
    return editorContent !== codeString;
  }, [codeString, editorContent]);

  // handle someone trying to open a different code editor
  useEffect(() => {
    if (editorInteractionState.waitingForEditorClose) {
      // if unsaved then show save dialog and wait for that to complete
      if (unsaved) {
        setShowSaveChangesAlert(true);
      }

      // otherwise either open the new editor or show the cell type menu (if type is not selected)
      else {
        const waitingForEditorClose = editorInteractionState.waitingForEditorClose;
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
  }, [editorInteractionState.waitingForEditorClose, setEditorInteractionState, unsaved]);

  // ensure codeCell is created w/content and updated when it receives a change request from Rust
  useEffect(() => {
    const updateCodeCell = async (pushCodeCell?: JsCodeCell) => {
      // selectedCellSheet may be undefined if code editor was activated from within the CellInput
      if (!editorInteractionState.selectedCellSheet) return;
      const codeCell =
        pushCodeCell ??
        (await quadraticCore.getCodeCell(
          editorInteractionState.selectedCellSheet,
          editorInteractionState.selectedCell.x,
          editorInteractionState.selectedCell.y
        ));

      const initialCode = editorInteractionState.initialCode;
      if (codeCell) {
        setCodeString(codeCell.code_string);
        setCellsAccessed(codeCell.cells_accessed);
        setOut({ stdOut: codeCell.std_out ?? undefined, stdErr: codeCell.std_err ?? undefined });
        if (!pushCodeCell) setEditorContent(initialCode ?? codeCell.code_string);
        const evaluationResult = codeCell.evaluation_result ? JSON.parse(codeCell.evaluation_result) : {};
        setEvaluationResult({ ...evaluationResult, ...codeCell.return_info });
        setSpillError(codeCell.spill_error?.map((c: Pos) => ({ x: Number(c.x), y: Number(c.y) } as Coordinate)));
      } else {
        setCodeString('');
        if (!pushCodeCell) setEditorContent(initialCode ?? '');
        setEvaluationResult(undefined);
        setOut(undefined);
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
    editorInteractionState.initialCode,
    editorInteractionState.selectedCell.x,
    editorInteractionState.selectedCell.y,
    editorInteractionState.selectedCellSheet,
    setEditorInteractionState,
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
        focusGrid();
        multiplayer.sendEndCellEdit();
      }
    },
    [setEditorInteractionState, unsaved]
  );

  // handle when escape is pressed when escape does not have focus
  useEffect(() => {
    if (editorInteractionState.editorEscapePressed) {
      if (unsaved) {
        setShowSaveChangesAlert(true);
      } else {
        closeEditor(true);
      }
    }
  }, [closeEditor, editorInteractionState.editorEscapePressed, unsaved]);

  const saveAndRunCell = async () => {
    const language = editorInteractionState.mode;

    if (language === undefined)
      throw new Error(`Language ${editorInteractionState.mode} not supported in CodeEditor#saveAndRunCell`);
    quadraticCore.setCodeCellValue({
      sheetId: cellLocation.sheetId,
      x: cellLocation.x,
      y: cellLocation.y,
      codeString: editorContent ?? '',
      language,
      cursor: sheets.getCursorPosition(),
    });

    setCodeString(editorContent ?? '');

    mixpanel.track('[CodeEditor].cellRun', {
      type: editorMode,
    });
    // Google Ads Conversion for running a cell
    if (googleAnalyticsAvailable()) {
      //@ts-expect-error
      gtag('event', 'conversion', {
        send_to: 'AW-11007319783/C-yfCJOe6JkZEOe92YAp',
      });
    }
  };

  const cancelPython = () => {
    if (pythonState !== 'running') return;

    pythonWebWorker.cancelExecution();
  };

  const onKeyDownEditor = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Don't allow the shortcuts below for certain users
    if (!hasPermissionToEditFile(editorInteractionState.permissions)) {
      return;
    }

    // Command + S
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault();
      saveAndRunCell();
    }

    // Command + Enter
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      saveAndRunCell();
    }

    // Command + Escape
    if ((event.metaKey || event.ctrlKey) && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelPython();
    }

    // Command + Plus
    if ((event.metaKey || event.ctrlKey) && event.key === '=') {
      event.preventDefault();
      event.stopPropagation();
      dispatchEditorAction('editor.action.fontZoomIn');
    }

    // Command + Minus
    if ((event.metaKey || event.ctrlKey) && event.key === '-') {
      event.preventDefault();
      event.stopPropagation();
      dispatchEditorAction('editor.action.fontZoomOut');
    }

    // Command + 0
    if ((event.metaKey || event.ctrlKey) && event.key === '0') {
      event.preventDefault();
      event.stopPropagation();
      dispatchEditorAction('editor.action.fontZoomReset');
    }
  };

  const afterDialog = () => {
    setShowSaveChangesAlert(false);
    if (editorInteractionState.editorEscapePressed) {
      closeEditor(true);
    }
    const waitingForEditorClose = editorInteractionState.waitingForEditorClose;
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
  };

  const codeEditorPanelData = useCodeEditorPanelData();

  if (!showCodeEditor) {
    return null;
  }

  return (
    <CodeEditorProvider>
      <div
        ref={containerRef}
        className={cn('relative flex bg-background', codeEditorPanelData.panelPosition === 'left' ? '' : 'flex-col')}
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
          className={cn('flex flex-col', codeEditorPanelData.panelPosition === 'left' ? 'order-2' : 'order-1')}
          style={{
            width: `${codeEditorPanelData.editorWidth}px`,
            height:
              codeEditorPanelData.panelPosition === 'left' ? '100%' : `${codeEditorPanelData.editorHeightPercentage}%`,
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
            cancelPython={cancelPython}
            closeEditor={() => closeEditor(false)}
          />
          <CodeEditorBody
            editorContent={editorContent}
            setEditorContent={setEditorContent}
            closeEditor={closeEditor}
            evaluationResult={evaluationResult}
            cellsAccessed={!unsaved ? cellsAccessed : []}
            cellLocation={cellLocation}
          />
          {editorInteractionState.mode === 'Python' && (
            <ReturnTypeInspector
              evaluationResult={evaluationResult}
              show={Boolean(evaluationResult?.line_number && !out?.stdErr && !unsaved)}
            />
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
                : `${100 - codeEditorPanelData.editorHeightPercentage}%`,
          }}
        >
          <Console
            consoleOutput={out}
            editorMode={editorMode}
            editorContent={editorContent}
            evaluationResult={evaluationResult}
            spillError={spillError}
            codeEditorPanelData={codeEditorPanelData}
          />
        </div>
        <CodeEditorPanels containerRef={containerRef} codeEditorPanelData={codeEditorPanelData} />
      </div>
    </CodeEditorProvider>
  );
};
