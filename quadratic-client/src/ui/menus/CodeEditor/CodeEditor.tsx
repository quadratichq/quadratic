/* eslint-disable @typescript-eslint/no-unused-vars */
import { pythonStateAtom } from '@/atoms/pythonStateAtom';
import { Coordinate } from '@/gridGL/types/size';
import { multiplayer } from '@/multiplayer/multiplayer';
import { Pos } from '@/quadratic-core/types';
import type { EvaluationResult } from '@/web-workers/pythonWebWorker/pythonTypes';
import mixpanel from 'mixpanel-browser';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
// TODO(ddimaria): leave this as we're looking to add this back in once improved
// import { Diagnostic } from 'vscode-languageserver-types';
import useLocalStorage from '@/hooks/useLocalStorage';
import { Button } from '@/shadcn/ui/button';
import { cn } from '@/shadcn/utils';
import { googleAnalyticsAvailable } from '@/utils/analytics';
import { ViewStreamOutlined } from '@mui/icons-material';
import { hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { grid } from '../../../grid/controller/Grid';
import { pixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { focusGrid } from '../../../helpers/focusGrid';
import { pythonWebWorker } from '../../../web-workers/pythonWebWorker/python';
import './CodeEditor.css';
import { CodeEditorBody } from './CodeEditorBody';
import { CodeEditorProvider } from './CodeEditorContext';
import { CodeEditorHeader } from './CodeEditorHeader';
import { Console } from './Console';
import { ResizeControl } from './ResizeControl';
import { ReturnTypeInspector } from './ReturnTypeInspector';
import { SaveChangesAlert } from './SaveChangesAlert';

const CODE_EDITOR_MIN_WIDTH = 350;
const PANEL_MIN_WIDTH = 300;

export const dispatchEditorAction = (name: string) => {
  window.dispatchEvent(new CustomEvent('run-editor-action', { detail: name }));
};

const CodeEditorLayout = () => {};

export const CodeEditor = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { showCodeEditor, mode: editorMode } = editorInteractionState;
  const { pythonState } = useRecoilValue(pythonStateAtom);
  const [editorWidth, setEditorWidth] = useLocalStorage<number>(
    'codeEditorWidth',
    window.innerWidth * 0.35 // default to 35% of the window width
  );
  const [editorHeightPercentage, setEditorHeightPercentage] = useLocalStorage<number>('codeEditorHeightPercentage', 75);
  const [panelWidth, setPanelWidth] = useLocalStorage('codeEditorPanelWidth', PANEL_MIN_WIDTH);
  const [panelHeightPercentage, setPanelHeightPercentage] = useLocalStorage<number>(
    'codeEditorPanelHeightPercentage',
    50
  );
  const [panelPosition, setPanelPosition] = useLocalStorage<PanelPosition>('codeEditorPanelPosition', 'left');
  const containerRef = useRef<HTMLDivElement>(null);

  // update code cell
  const [codeString, setCodeString] = useState('');

  // code info
  const [out, setOut] = useState<{ stdOut?: string; stdErr?: string } | undefined>(undefined);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | undefined>(undefined);
  const [spillError, setSpillError] = useState<Coordinate[] | undefined>();

  const [showSaveChangesAlert, setShowSaveChangesAlert] = useState(false);
  const [editorContent, setEditorContent] = useState<string | undefined>(codeString);
  // TODO(ddimaria): leave this as we're looking to add this back in once improved
  // const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);

  const cellLocation = useMemo(() => {
    return {
      x: editorInteractionState.selectedCell.x,
      y: editorInteractionState.selectedCell.y,
      sheetId: editorInteractionState.selectedCellSheet,
    };
  }, [
    editorInteractionState.selectedCell.x,
    editorInteractionState.selectedCell.y,
    editorInteractionState.selectedCellSheet,
  ]);

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
          setEditorInteractionState((oldState) => ({
            ...oldState,
            selectedCell: waitingForEditorClose.selectedCell,
            selectedCellSheet: waitingForEditorClose.selectedCellSheet,
            mode: waitingForEditorClose.mode,
            showCodeEditor: !waitingForEditorClose.showCellTypeMenu,
            showCellTypeMenu: waitingForEditorClose.showCellTypeMenu,
            waitingForEditorClose: undefined,
          }));
        }
      }
    }
  }, [editorInteractionState.waitingForEditorClose, setEditorInteractionState, unsaved]);

  const updateCodeCell = useCallback(
    (updateEditorContent: boolean) => {
      // selectedCellSheet may be undefined if code editor was activated from within the CellInput
      if (!editorInteractionState.selectedCellSheet) return;
      const codeCell = grid.getCodeCell(
        editorInteractionState.selectedCellSheet,
        editorInteractionState.selectedCell.x,
        editorInteractionState.selectedCell.y
      );

      if (codeCell) {
        setCodeString(codeCell.code_string);
        setOut({ stdOut: codeCell.std_out ?? undefined, stdErr: codeCell.std_err ?? undefined });

        if (updateEditorContent) setEditorContent(codeCell.code_string);

        const evaluationResult = codeCell.evaluation_result ? JSON.parse(codeCell.evaluation_result) : {};
        setEvaluationResult({ ...evaluationResult, ...codeCell.return_info });
        setSpillError(codeCell.spill_error?.map((c: Pos) => ({ x: Number(c.x), y: Number(c.y) } as Coordinate)));
      } else {
        setCodeString('');
        if (updateEditorContent) setEditorContent('');
        setEvaluationResult(undefined);
        setOut(undefined);
      }
    },
    [
      editorInteractionState.selectedCell.x,
      editorInteractionState.selectedCell.y,
      editorInteractionState.selectedCellSheet,
    ]
  );

  useEffect(() => {
    updateCodeCell(true);

    const update = () => updateCodeCell(false);
    window.addEventListener('code-cells-update', update);
    return () => {
      window.removeEventListener('code-cells-update', update);
    };
  }, [updateCodeCell]);

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
    multiplayer.sendCellEdit('', 0, true);
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
        }));
        pixiApp.highlightedCells.clear();
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

    grid.setCodeCellValue({
      sheetId: cellLocation.sheetId,
      x: cellLocation.x,
      y: cellLocation.y,
      codeString: editorContent ?? '',
      language,
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

    pythonWebWorker.restartFromUser();
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
        showCodeEditor: !waitingForEditorClose.showCellTypeMenu,
        showCellTypeMenu: waitingForEditorClose.showCellTypeMenu,
        waitingForEditorClose: undefined,
      }));
    } else {
      closeEditor(true);
    }
  };

  if (!showCodeEditor) {
    return null;
  }

  const width = editorWidth + (panelPosition === 'left' ? panelWidth : 0);
  console.log(panelPosition === 'left' ? '100%' : `${100 - editorHeightPercentage}%`);

  return (
    <CodeEditorProvider>
      <div
        ref={containerRef}
        className={cn(
          'absolute bottom-0 right-0 top-0 z-[2] flex max-w-[90%] bg-background',
          panelPosition === 'left' ? '' : 'flex-col'
        )}
        style={{ width: `${width}px` }}
      >
        <div
          id="QuadraticCodeEditorID"
          className={cn('flex flex-col', panelPosition === 'left' ? 'order-2' : 'order-1')}
          style={{
            width: `${editorWidth}px`,
            height: panelPosition === 'left' ? '100%' : `${editorHeightPercentage}%`,
          }}
          onKeyDownCapture={onKeyDownEditor}
          onPointerEnter={() => {
            // todo: handle multiplayer code editor here
            multiplayer.sendMouseMove();
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
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
          />
          {editorInteractionState.mode === 'Python' && (
            <ReturnTypeInspector
              evaluationResult={evaluationResult}
              show={Boolean(evaluationResult?.line_number && !out?.stdErr && !unsaved)}
            />
          )}

          {/* Console Wrapper */}
        </div>

        <div
          className={cn(panelPosition === 'left' ? 'order-1' : 'order-2', 'relative flex flex-col bg-background')}
          style={{
            width: panelPosition === 'left' ? `${panelWidth}px` : '100%',
            height: panelPosition === 'left' ? '100%' : `${100 - editorHeightPercentage}%`,
          }}
        >
          <Console
            consoleOutput={out}
            editorMode={editorMode}
            editorContent={editorContent}
            evaluationResult={evaluationResult}
            spillError={spillError}
            panelPosition={panelPosition}
            setPanelPosition={setPanelPosition}
            editorWidth={editorWidth}
            secondPanelWidth={panelWidth}
            secondPanelHeightPercentage={panelHeightPercentage}
          />
        </div>

        {/*panelPosition === 'left' ? (
          <>
            
            
          </>
        ) : (
          <ResizeControl
            setState={(mouseEvent) => {
              const offsetFromRight = window.innerWidth - mouseEvent.x;
              setEditorWidth(offsetFromRight > CODE_EDITOR_MIN_WIDTH ? offsetFromRight : CODE_EDITOR_MIN_WIDTH);
            }}
            position="LEFT"
            min={CODE_EDITOR_MIN_WIDTH}
          />
          )*/}

        {panelPosition === 'left' && (
          <>
            {/* PanelHeightPercentage */}
            <ResizeControl
              style={{ top: panelHeightPercentage + '%', width: panelWidth + 'px' }}
              setState={(mouseEvent) => {
                if (!containerRef.current) return;

                const containerRect = containerRef.current?.getBoundingClientRect();
                const newTopHeight = ((mouseEvent.clientY - containerRect.top) / containerRect.height) * 100;

                if (newTopHeight >= 25 && newTopHeight <= 75) {
                  setPanelHeightPercentage(newTopHeight);
                }
              }}
              position="HORIZONTAL"
            />
            {/* PanelWidth */}
            <ResizeControl
              style={{ left: `-1px` }}
              setState={(mouseEvent) => {
                const offsetFromRight = window.innerWidth - mouseEvent.x - editorWidth;
                setPanelWidth(offsetFromRight > PANEL_MIN_WIDTH ? offsetFromRight : PANEL_MIN_WIDTH);
                // const xPos = setState(min ? (newValue > min ? newValue : min) : newValue);
              }}
              position="VERTICAL"
            />
            {/* EditorWidth */}
            <ResizeControl
              style={{ left: panelWidth + 'px' }}
              setState={(mouseEvent) => {
                const offsetFromRight = window.innerWidth - mouseEvent.x;
                setEditorWidth(offsetFromRight > CODE_EDITOR_MIN_WIDTH ? offsetFromRight : CODE_EDITOR_MIN_WIDTH);
              }}
              position="VERTICAL"
            />
          </>
        )}

        {panelPosition === 'bottom' && (
          <>
            {/* PanelAndEditorWidth */}
            <ResizeControl
              style={{ left: '-1px' }}
              setState={(mouseEvent) => {
                const offsetFromRight = window.innerWidth - mouseEvent.x;
                setEditorWidth(offsetFromRight > CODE_EDITOR_MIN_WIDTH ? offsetFromRight : CODE_EDITOR_MIN_WIDTH);
              }}
              position="VERTICAL"
            />
            {/* PanelAndEditorHeightPercentage */}
            <ResizeControl
              style={{ top: editorHeightPercentage + '%', width: '100%' }}
              setState={(mouseEvent) => {
                if (!containerRef.current) return;

                const containerRect = containerRef.current?.getBoundingClientRect();
                const newTopHeight = ((mouseEvent.clientY - containerRect.top) / containerRect.height) * 100;

                if (newTopHeight >= 25 && newTopHeight <= 75) {
                  setEditorHeightPercentage(newTopHeight);
                }
              }}
              position="HORIZONTAL"
            />
          </>
        )}
      </div>
    </CodeEditorProvider>
  );
};

type PanelPosition = 'bottom' | 'left';
export function PanelToggle({
  position,
  setPosition,
}: {
  position: PanelPosition;
  setPosition: React.Dispatch<React.SetStateAction<PanelPosition>>;
}) {
  return (
    <div className="absolute right-1 top-1">
      <Button size="icon" variant={position === 'bottom' ? 'secondary' : 'ghost'} onClick={() => setPosition('bottom')}>
        <ViewStreamOutlined className="text-foreground opacity-50" fontSize="small" style={{}} />
      </Button>
      <Button size="icon" variant={position === 'left' ? 'secondary' : 'ghost'} onClick={() => setPosition('left')}>
        <ViewStreamOutlined className="rotate-90 opacity-50" fontSize="small" />
      </Button>
    </div>
  );
}
