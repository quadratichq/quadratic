/* eslint-disable @typescript-eslint/no-unused-vars */
import mixpanel from 'mixpanel-browser';
import React, { useCallback, useMemo, useState } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { isEditorOrAbove } from '../../../actions';
import {
  editorHighlightedCellsStateAtom,
  editorHighlightedCellsStateDefault,
} from '../../../atoms/editorHighlightedCellsStateAtom';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { sheets } from '../../../grid/controller/Sheets';
import { webWorkers } from '../../../web-workers/webWorkers';
import { CodeEditorBody } from './CodeEditorBody';
import { CodeEditorHeader } from './CodeEditorHeader';
import { Console } from './Console';
import { ResizeControl } from './ResizeControl';
import { SaveChangesAlert } from './SaveChangesAlert';

export const CodeEditor = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const setEditorHighlightedCells = useSetRecoilState(editorHighlightedCellsStateAtom);
  const { showCodeEditor, mode: editorMode } = editorInteractionState;

  const [isRunningComputation, setIsRunningComputation] = useState(false);

  const [editorWidth, setEditorWidth] = useState<number>(
    window.innerWidth * 0.35 // default to 35% of the window width
  );

  // Console height state
  const [consoleHeight, setConsoleHeight] = useState<number>(200);

  // Save changes alert state
  const [showSaveChangesAlert, setShowSaveChangesAlert] = useState(false);

  const cellLocation = useMemo(
    () => ({ x: editorInteractionState.selectedCell.x, y: editorInteractionState.selectedCell.y }),
    [editorInteractionState.selectedCell.x, editorInteractionState.selectedCell.y]
  );

  const [editorContent, setEditorContent] = useState<string | undefined>();
  const cell = useMemo(() => {
    mixpanel.track('[CodeEditor].opened', { type: editorMode });
    const cellCodeValue = sheets.sheet.getCodeValue(
      editorInteractionState.selectedCell.x,
      editorInteractionState.selectedCell.y
    );
    setEditorContent(cellCodeValue?.code_string ?? '');
    return cellCodeValue;
  }, [editorInteractionState.selectedCell, editorMode]);

  const closeEditor = useCallback(
    (skipSaveCheck: boolean) => {
      if (!skipSaveCheck && editorContent !== cell?.code_string) {
        setShowSaveChangesAlert(true);
      } else {
        setEditorInteractionState((oldState) => ({
          ...oldState,
          showCodeEditor: false,
        }));
        setEditorHighlightedCells(editorHighlightedCellsStateDefault);
      }
    },
    [cell?.code_string, editorContent, setEditorHighlightedCells, setEditorInteractionState]
  );

  const saveAndRunCell = useCallback(async () => {
    if (editorContent) {
      const results = await webWorkers.runPython(editorContent);
      console.log(results);
    }
    // sheetController.sheet.set;
  }, [editorContent]);

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

  if (cell === undefined || !showCodeEditor) {
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
        cell={cell}
        cellLocation={cellLocation}
        unsaved={false}
        isRunningComputation={isRunningComputation}
        saveAndRunCell={saveAndRunCell}
        closeEditor={() => closeEditor(false)}
      />
      <CodeEditorBody cell={cell} editorContent={editorContent} setEditorContent={setEditorContent} />
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
          <Console evalResult={cell.output} editorMode={editorMode} editorContent={editorContent} selectedCell={cell} />
        )}
      </div>
    </div>
  );
};
