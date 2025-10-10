import { codeEditorShowCodeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { CodeEditorBody } from '@/app/ui/menus/CodeEditor/CodeEditorBody';
import { CodeEditorDiffButtons } from '@/app/ui/menus/CodeEditor/CodeEditorDiffButtons';
import { CodeEditorEffects } from '@/app/ui/menus/CodeEditor/CodeEditorEffects';
import { CodeEditorEmptyState } from '@/app/ui/menus/CodeEditor/CodeEditorEmptyState';
import { CodeEditorEscapeEffect } from '@/app/ui/menus/CodeEditor/CodeEditorEscapeEffect';
import { CodeEditorHeader } from '@/app/ui/menus/CodeEditor/CodeEditorHeader';
import { useOnKeyDownCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useOnKeyDownCodeEditor';
import { CodeEditorPanel } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanel';
import { CodeEditorPanels } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelsResize';
import { useCodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { ReturnTypeInspector } from '@/app/ui/menus/CodeEditor/ReturnTypeInspector';
import { SaveChangesAlert } from '@/app/ui/menus/CodeEditor/SaveChangesAlert';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { cn } from '@/shared/shadcn/utils';
import type * as monaco from 'monaco-editor';
import { memo, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import './CodeEditor.css';

export const CodeEditor = memo(() => {
  const showCodeEditor = useRecoilValue(codeEditorShowCodeEditorAtom);
  const [editorInst, setEditorInst] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const { onKeyDownCodeEditor } = useOnKeyDownCodeEditor();
  const codeEditorRef = useRef<HTMLDivElement | null>(null);
  const codeEditorPanelData = useCodeEditorPanelData();

  return (
    <>
      <CodeEditorEffects />

      <CodeEditorEscapeEffect editorInst={editorInst} />

      {showCodeEditor && (
        <div className="relative flex h-full flex-col">
          {/* hack required for correct height calculation */}
          {codeEditorPanelData.panelPosition === 'left' && <CodeEditorHeader editorInst={editorInst} />}

          <div
            ref={codeEditorRef}
            className={cn(
              'relative -mt-[1px] flex h-full flex-col overflow-visible border-t border-transparent bg-background',
              codeEditorPanelData.panelPosition === 'left' ? 'flex-row border-t border-border' : 'flex-col'
            )}
            style={{
              width: `${
                codeEditorPanelData.editorWidth +
                (codeEditorPanelData.panelPosition === 'left' ? codeEditorPanelData.panelWidth : 0)
              }px`,
            }}
            onCopy={(e) => e.stopPropagation()}
            onCut={(e) => e.stopPropagation()}
            onPaste={(e) => e.stopPropagation()}
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
              onKeyDownCapture={onKeyDownCodeEditor}
              onPointerEnter={() => {
                // todo: handle multiplayer code editor here
                multiplayer.sendMouseMove();
              }}
            >
              {/* hack required for correct height calculation */}
              {codeEditorPanelData.panelPosition !== 'left' && <CodeEditorHeader editorInst={editorInst} />}

              <SaveChangesAlert editorInst={editorInst} />
              <CodeEditorDiffButtons />
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
        </div>
      )}
    </>
  );
});
