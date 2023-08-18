/* eslint-disable @typescript-eslint/no-unused-vars */
import mixpanel from 'mixpanel-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { SheetController } from '../../../grid/controller/SheetController';
import { CodeEditorBody } from './CodeEditorBody';
import { CodeEditorHeader } from './CodeEditorHeader';
import { ResizeControl } from './ResizeControl';
import { SaveChangesAlert } from './SaveChangesAlert';

interface CodeEditorProps {
  sheetController: SheetController;
}

export const CodeEditor = (props: CodeEditorProps) => {
  const { sheetController } = props;
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { showCodeEditor, mode: editorMode } = editorInteractionState;

  const [isRunningComputation, setIsRunningComputation] = useState(false);

  const [editorWidth, setEditorWidth] = useState<number>(
    window.innerWidth * 0.35 // default to 35% of the window width
  );

  // Console height state
  const [consoleHeight, setConsoleHeight] = useState<number>(200);

  // Save changes alert state
  const [showSaveChangesAlert, setShowSaveChangesAlert] = useState<boolean>(false);

  const cellLocation = { x: editorInteractionState.selectedCell.x, y: editorInteractionState.selectedCell.y };

  const cell = useMemo(
    () => sheetController.sheet.getCodeValue(cellLocation.x, cellLocation.y),
    [cellLocation.x, cellLocation.y, sheetController.sheet]
  );

  // listens to cursor-position event to update cell
  const [trigger, setTrigger] = useState(0);
  useEffect(() => {
    const changeTrigger = () => setTrigger((trigger) => trigger + 1);
    window.addEventListener('cursor-position', changeTrigger);
    return () => window.removeEventListener('cursor-position', changeTrigger);
  }, []);

  useEffect(() => {
    if (showCodeEditor) mixpanel.track('[CodeEditor].opened', { type: editorMode });
  }, [showCodeEditor, editorMode]);

  // todo
  const closeEditor = useCallback((skipSaveCheck = false) => {}, []);

  const saveAndRunCell = useCallback(() => {}, []);

  const onKeyDownEditor = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
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

      // Esc
      if (!(event.metaKey || event.ctrlKey) && event.key === 'Escape') {
        event.preventDefault();
        closeEditor();
      }
    },
    [closeEditor, saveAndRunCell]
  );

  if (cell === undefined || !editorInteractionState.showCodeEditor) {
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
        closeEditor={closeEditor}
      />
      <CodeEditorBody cell={cell} />
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
        {/* {(editorInteractionState.mode === 'PYTHON' || editorInteractionState.mode === 'FORMULA') && (
          <Console
            evalResult={evalResult}
            editorMode={editorMode}
            editorContent={editorContent}
            selectedCell={selectedCell}
          />
        )} */}
      </div>
    </div>
  );
};
