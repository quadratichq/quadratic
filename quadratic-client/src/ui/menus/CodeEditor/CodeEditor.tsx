/* eslint-disable @typescript-eslint/no-unused-vars */
import { pythonStateAtom } from '@/atoms/pythonStateAtom';
import { multiplayer } from '@/multiplayer/multiplayer';
import mixpanel from 'mixpanel-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { hasPerissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { grid } from '../../../grid/controller/Grid';
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

  const [out, setOut] = useState<{ stdOut?: string; stdErr?: string } | undefined>(undefined);
  const [evaluationResult, setEvaluationResult] = useState<any>(undefined);
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

  // update code cell
  const unsaved = useMemo(() => {
    return editorContent !== codeString;
  }, [codeString, editorContent]);

  const updateCodeCell = useCallback(
    (updateEditorContent: boolean) => {
      const codeCell = grid.getCodeCell(
        editorInteractionState.selectedCellSheet,
        editorInteractionState.selectedCell.x,
        editorInteractionState.selectedCell.y
      );
      if (codeCell) {
        setCodeString(codeCell.code_string);
        setOut({ stdOut: codeCell.std_out ?? undefined, stdErr: codeCell.std_err ?? undefined });
        if (updateEditorContent) setEditorContent(codeCell.code_string);
        setEvaluationResult(codeCell.evaluation_result);
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
  }, [updateCodeCell]);

  useEffect(() => {
    mixpanel.track('[CodeEditor].opened', { type: editorMode });
    multiplayer.sendCellEdit('', 0, true);
  }, [editorMode]);

  const closeEditor = useCallback(
    (skipSaveCheck: boolean) => {
      if (!skipSaveCheck && editorContent !== codeString) {
        setShowSaveChangesAlert(true);
      } else {
        setEditorInteractionState((oldState) => ({
          ...oldState,
          showCodeEditor: false,
        }));
        pixiApp.highlightedCells.clear();
        focusGrid();
        multiplayer.sendEndCellEdit();
      }
    },
    [codeString, editorContent, setEditorInteractionState]
  );

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
      code: editorContent,
    });
  };

  const cancelPython = () => {
    if (pythonState !== 'running') return;

    pythonWebWorker.restartFromUser();
  };

  const onKeyDownEditor = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Don't allow the shortcuts below for certain users
    if (!hasPerissionToEditFile(editorInteractionState.permissions)) {
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
          }}
          onSave={() => {
            saveAndRunCell();
            closeEditor(true);
          }}
          onDiscard={() => {
            closeEditor(true);
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
          />
        )}
      </div>
    </div>
  );
};
