/* eslint-disable @typescript-eslint/no-unused-vars */
import { pythonStateAtom } from '@/atoms/pythonStateAtom';
import { sheets } from '@/grid/controller/Sheets';
import { Coordinate } from '@/gridGL/types/size';
import { multiplayer } from '@/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/web-workers/quadraticCore/quadraticCore';
import mixpanel from 'mixpanel-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { pixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { focusGrid } from '../../../helpers/focusGrid';
import { pythonWebWorker } from '../../../web-workers/pythonWebWorker/python';
import { CodeEditorBody } from './CodeEditorBody';
import { CodeEditorHeader } from './CodeEditorHeader';
import { Console } from './Console';
import { ResizeControl } from './ResizeControl';
import { SaveChangesAlert } from './SaveChangesAlert';

export const CodeEditor = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { showCodeEditor, mode: editorMode } = editorInteractionState;
  const { pythonState } = useRecoilValue(pythonStateAtom);

  // update code cell
  const [codeString, setCodeString] = useState('');

  // code info
  const [out, setOut] = useState<{ stdOut?: string; stdErr?: string } | undefined>(undefined);
  const [evaluationResult, setEvaluationResult] = useState<any>(undefined);
  const [spillError, setSpillError] = useState<Coordinate[] | undefined>();

  const [editorWidth, setEditorWidth] = useState<number>(
    window.innerWidth * 0.35 // default to 35% of the window width
  );
  const [consoleHeight, setConsoleHeight] = useState<number>(200);
  const [showSaveChangesAlert, setShowSaveChangesAlert] = useState(false);
  const [editorContent, setEditorContent] = useState<string | undefined>(codeString);

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
    async (updateEditorContent: boolean) => {
      // selectedCellSheet may be undefined if code editor was activated from within the CellInput
      if (!editorInteractionState.selectedCellSheet) return;
      const codeCell = await quadraticCore.getCodeCell(
        editorInteractionState.selectedCellSheet,
        editorInteractionState.selectedCell.x,
        editorInteractionState.selectedCell.y
      );
      if (codeCell) {
        setCodeString(codeCell.code_string);
        setOut({ stdOut: codeCell.std_out ?? undefined, stdErr: codeCell.std_err ?? undefined });
        if (updateEditorContent) setEditorContent(codeCell.code_string);
        setEvaluationResult(codeCell.evaluation_result);
        setSpillError(codeCell.spill_error?.map((c) => ({ x: Number(c.x), y: Number(c.y) })));
      } else {
        setCodeString('');
        if (updateEditorContent) setEditorContent('');
        setEvaluationResult('');
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
      code: editorContent,
    });
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

  return (
    <div
      id="QuadraticCodeEditorID"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        width: `${editorWidth}px`,
        minWidth: '350px',
        maxWidth: '90%',
        backgroundColor: '#ffffff',
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

      <ResizeControl setState={setEditorWidth} position="LEFT" />
      <CodeEditorHeader
        cellLocation={cellLocation}
        unsaved={unsaved}
        saveAndRunCell={saveAndRunCell}
        cancelPython={cancelPython}
        closeEditor={() => closeEditor(false)}
      />
      <CodeEditorBody editorContent={editorContent} setEditorContent={setEditorContent} closeEditor={closeEditor} />
      <ResizeControl setState={setConsoleHeight} position="TOP" />

      {/* Console Wrapper */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100px',
          background: '#fff',
          height: `${consoleHeight}px`,
        }}
      >
        {(editorInteractionState.mode === 'Python' || editorInteractionState.mode === 'Formula') && (
          <Console
            consoleOutput={out}
            editorMode={editorMode}
            editorContent={editorContent}
            evaluationResult={evaluationResult}
            spillError={spillError}
          />
        )}
      </div>
    </div>
  );
};
