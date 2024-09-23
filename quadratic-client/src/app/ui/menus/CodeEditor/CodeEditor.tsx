import {
  codeEditorCellLocationAtom,
  codeEditorPanelBottomActiveTabAtom,
  codeEditorShowSaveChangesAlertAtom,
  codeEditorUnsavedChangesAtom,
} from '@/app/atoms/codeEditorAtom';
import {
  editorInteractionStateAtom,
  editorInteractionStateEditorEscapePressedAtom,
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
import { CodeEditorBody } from '@/app/ui/menus/CodeEditor/CodeEditorBody';
import { CodeEditorEmptyState } from '@/app/ui/menus/CodeEditor/CodeEditorEmptyState';
import { CodeEditorHeader } from '@/app/ui/menus/CodeEditor/CodeEditorHeader';
import { CodeEditorPanel } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanel';
import { CodeEditorPanels } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelsResize';
import { useCodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { ReturnTypeInspector } from '@/app/ui/menus/CodeEditor/ReturnTypeInspector';
import { SaveChangesAlert } from '@/app/ui/menus/CodeEditor/SaveChangesAlert';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/useCodeEditor';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { cn } from '@/shared/shadcn/utils';
import mixpanel from 'mixpanel-browser';
import * as monaco from 'monaco-editor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import './CodeEditor.css';
// TODO(ddimaria): leave this as we're looking to add this back in once improved
// import { Diagnostic } from 'vscode-languageserver-types';

export const dispatchEditorAction = (name: string) => {
  window.dispatchEvent(new CustomEvent('run-editor-action', { detail: name }));
};

export const CodeEditor = () => {
  const showCodeEditor = useRecoilValue(editorInteractionStateShowCodeEditorAtom);
  const selectedCellSheet = useRecoilValue(editorInteractionStateSelectedCellSheetAtom);
  const selectedCell = useRecoilValue(editorInteractionStateSelectedCellAtom);
  const initialCode = useRecoilValue(editorInteractionStateInitialCodeAtom);
  const editorMode = useRecoilValue(editorInteractionStateModeAtom);
  const mode = useMemo(() => getLanguage(editorMode), [editorMode]);
  const editorEscapePressed = useRecoilValue(editorInteractionStateEditorEscapePressedAtom);
  const waitingForEditorClose = useRecoilValue(editorInteractionStateWaitingForEditorCloseAtom);
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  const cellLocation = useRecoilValue(codeEditorCellLocationAtom);
  const setPanelBottomActiveTab = useSetRecoilState(codeEditorPanelBottomActiveTabAtom);
  const setShowSaveChangesAlert = useSetRecoilState(codeEditorShowSaveChangesAlertAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);

  const [editorInst, setEditorInst] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  // TODO(ddimaria): leave this as we're looking to add this back in once improved
  // const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);

  const { onKeyDownEditor, closeEditor, updateCodeEditor } = useCodeEditor({
    editorInst,
  });

  // Trigger vanilla changes to code editor
  useEffect(() => {
    if (showCodeEditor) {
      events.emit('codeEditor');
      setPanelBottomActiveTab(mode === 'Connection' ? 'data-browser' : 'console');
    }
  }, [cellLocation, mode, showCodeEditor, setPanelBottomActiveTab]);

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
    updateCodeEditor(selectedCellSheet, selectedCell, undefined, initialCode);
  }, [initialCode, selectedCell, selectedCell.x, selectedCell.y, selectedCellSheet, updateCodeEditor]);

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

  // handle when escape is pressed when escape does not have focus
  useEffect(() => {
    if (editorEscapePressed) {
      if (unsavedChanges) {
        setShowSaveChangesAlert(true);
      } else {
        closeEditor(true);
      }
    }
  }, [closeEditor, editorEscapePressed, setShowSaveChangesAlert, unsavedChanges]);

  const codeEditorRef = useRef<HTMLDivElement | null>(null);
  const codeEditorPanelData = useCodeEditorPanelData();

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
        <SaveChangesAlert editorInst={editorInst} />

        <CodeEditorHeader editorInst={editorInst} />

        <CodeEditorBody editorInst={editorInst} setEditorInst={setEditorInst} />

        <CodeEditorEmptyState editorInst={editorInst} />

        <ReturnTypeInspector />
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
        <CodeEditorPanel editorInst={editorInst} codeEditorRef={codeEditorRef} />
      </div>
      <CodeEditorPanels codeEditorRef={codeEditorRef} />
    </div>
  );
};
