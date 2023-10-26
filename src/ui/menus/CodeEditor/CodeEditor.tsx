/* eslint-disable @typescript-eslint/no-unused-vars */
import mixpanel from 'mixpanel-browser';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { isEditorOrAbove } from '../../../actions';
import {
  editorHighlightedCellsStateAtom,
  editorHighlightedCellsStateDefault,
} from '../../../atoms/editorHighlightedCellsStateAtom';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { grid } from '../../../grid/controller/Grid';
import { focusGrid } from '../../../helpers/focusGrid';
import { CodeCellLanguage } from '../../../quadratic-core/quadratic_core';
import { CodeEditorBody } from './CodeEditorBody';
import { CodeEditorHeader } from './CodeEditorHeader';
import { Console } from './Console';
import { ResizeControl } from './ResizeControl';
import { SaveChangesAlert } from './SaveChangesAlert';

export const CodeEditor = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const setEditorHighlightedCells = useSetRecoilState(editorHighlightedCellsStateAtom);
  const { showCodeEditor, mode: editorMode } = editorInteractionState;
  const isRunningComputation = useRef(false);

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
  const [codeString, setCodeString] = useState('');
  const [out, setOut] = useState<{ stdOut?: string; stdErr?: string } | undefined>(undefined);
  const [evaluationResult, setEvaluationResult] = useState<any>(undefined);
  const updateCodeCell = useCallback(() => {
    // this is wrong. sheet.id needs to be set on open
    const codeCell = grid.getCodeCell(
      editorInteractionState.selectedCellSheet,
      editorInteractionState.selectedCell.x,
      editorInteractionState.selectedCell.y
    );
    if (codeCell) {
      const codeString = codeCell.getCodeString();
      setCodeString(codeString);
      setOut({ stdOut: codeCell.getStdOut(), stdErr: codeCell.getStdErr() });
      setEditorContent(codeString);
      setEvaluationResult(codeCell.getEvaluationResult());
      codeCell.free();
    } else {
      setCodeString('');
      setEditorContent('');
      setEvaluationResult('');
      setOut(undefined);
    }
  }, [
    editorInteractionState.selectedCell.x,
    editorInteractionState.selectedCell.y,
    editorInteractionState.selectedCellSheet,
  ]);

  // ensures that the console is updated after the code cell is run (for async calculations, like Python)
  useEffect(() => {
    window.addEventListener('computation-complete', updateCodeCell);
    return () => window.removeEventListener('computation-complete', updateCodeCell);
  });

  useEffect(() => {
    updateCodeCell();
  }, [updateCodeCell]);

  const [editorWidth, setEditorWidth] = useState<number>(
    window.innerWidth * 0.35 // default to 35% of the window width
  );

  // Console height state
  const [consoleHeight, setConsoleHeight] = useState<number>(200);

  // Save changes alert state
  const [showSaveChangesAlert, setShowSaveChangesAlert] = useState(false);

  const [editorContent, setEditorContent] = useState<string | undefined>(codeString);
  useEffect(() => {
    mixpanel.track('[CodeEditor].opened', { type: editorMode });
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
        setEditorHighlightedCells(editorHighlightedCellsStateDefault);
        focusGrid();
      }
    },
    [codeString, editorContent, setEditorHighlightedCells, setEditorInteractionState]
  );

  const saveAndRunCell = async () => {
    if (isRunningComputation.current) return;
    isRunningComputation.current = true;
    const language =
      editorInteractionState.mode === 'PYTHON'
        ? CodeCellLanguage.Python
        : editorInteractionState.mode === 'FORMULA'
        ? CodeCellLanguage.Formula
        : undefined;
    if (language === undefined)
      throw new Error(`Language ${editorInteractionState.mode} not supported in CodeEditor#saveAndRunCell`);
    grid.setCodeCellValue({
      sheetId: cellLocation.sheetId,
      x: cellLocation.x,
      y: cellLocation.y,
      codeString: editorContent ?? '',
      language,
    });
    isRunningComputation.current = false;

    mixpanel.track('[CodeEditor].cellRun', {
      type: editorMode,
      code: editorContent,
    });
  };

  const onKeyDownEditor = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Esc
    if (!(event.metaKey || event.ctrlKey) && event.key === 'Escape') {
      event.preventDefault();
      closeEditor(true);
    }

    // Don't allow the shortcuts below for certain users
    if (!isEditorOrAbove(editorInteractionState.permission)) {
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
        unsaved={false}
        isRunningComputation={isRunningComputation.current}
        saveAndRunCell={saveAndRunCell}
        closeEditor={() => closeEditor(false)}
      />
      <CodeEditorBody editorContent={editorContent} setEditorContent={setEditorContent} />
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
        {(editorInteractionState.mode === 'PYTHON' || editorInteractionState.mode === 'FORMULA') && (
          <Console
            consoleInput={out}
            editorMode={editorMode}
            editorContent={editorContent}
            evaluationResult={evaluationResult}
          />
        )}
      </div>
    </div>
  );
};
