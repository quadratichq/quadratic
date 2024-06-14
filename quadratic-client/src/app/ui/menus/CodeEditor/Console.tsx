import { Coordinate } from '@/app/gridGL/types/size';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { SchemaViewer } from '@/app/ui/connections/SchemaViewer';
import { PanelPositionBottomIcon, PanelPositionLeftIcon } from '@/app/ui/icons';
import { CodeEditorPanelData, PanelPosition } from '@/app/ui/menus/CodeEditor/useCodeEditorPanelData';
import type { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { cn } from '@/shared/shadcn/utils';
import { IconButton } from '@mui/material';
import { useState } from 'react';
import { useRecoilValue } from 'recoil';
import { EditorInteractionState, editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { colors } from '../../../theme/colors';
import { AiAssistant } from './AiAssistant';
import { codeEditorBaseStyles, codeEditorCommentStyles } from './styles';

interface ConsoleProps {
  consoleOutput?: { stdOut?: string; stdErr?: string };
  editorMode: EditorInteractionState['mode'];
  editorContent: string | undefined;
  evaluationResult?: EvaluationResult;
  spillError?: Coordinate[];
  codeEditorPanelData: CodeEditorPanelData;
}

type Tab = 'console' | 'ai-assistant' | 'data-browser';

export function Console(props: ConsoleProps) {
  const {
    consoleOutput,
    editorMode,
    editorContent,
    evaluationResult,
    spillError,
    codeEditorPanelData,
    codeEditorPanelData: { panelPosition, setPanelPosition, panelHeightPercentages },
  } = props;
  const { isAuthenticated } = useRootRouteLoaderData();
  const [tab, setTab] = useState<Tab>('console');
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const hasOutput = Boolean(consoleOutput?.stdErr?.length || consoleOutput?.stdOut?.length || spillError);

  const consoleBadgeSharedClasses = `font-medium`;
  const isConnection = typeof editorInteractionState.mode === 'object';

  return (
    <>
      {/* Panel position (left/bottom) control */}
      <div className={cn('absolute', panelPosition === 'bottom' ? 'right-1.5 top-1.5' : 'right-0.5 top-0.5')}>
        <TooltipHint title={panelPosition === 'bottom' ? 'Move panel left' : 'Move panel bottom'}>
          <IconButton
            onClick={(e) => {
              setPanelPosition((prev: PanelPosition) => (prev === 'left' ? 'bottom' : 'left'));
              // TODO: figure out why keeping focus is kinda ugly
              e.currentTarget.blur();
            }}
          >
            {panelPosition === 'left' ? <PanelPositionBottomIcon /> : <PanelPositionLeftIcon />}
          </IconButton>
        </TooltipHint>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as Tab);
        }}
        className={cn('h-full', panelPosition === 'bottom' && 'grid grid-rows-[auto_1fr]')}
      >
        {/* Only visible when panel is on the bottom */}
        <div className={cn(panelPosition !== 'bottom' && 'hidden', 'px-2 pb-2 pt-2')}>
          <TabsList>
            <TabsTrigger
              value="console"
              className={cn(
                `relative after:absolute after:right-1 after:top-1`,
                consoleBadgeSharedClasses,
                tab !== 'console' && hasOutput && `after:h-[5px] after:w-[5px] after:rounded-full after:content-['']`,
                tab !== 'console' && consoleOutput?.stdErr ? 'after:bg-destructive' : 'after:bg-muted-foreground'
              )}
            >
              Console
            </TabsTrigger>
            <TabsTrigger value="ai-assistant">AI assistant</TabsTrigger>
            {/* TODO: (connections) if it's sql and you have permission */}
            {isConnection && <TabsTrigger value="data-browser">Data browser</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent
          forceMount={true}
          value="console"
          className={cn(
            'm-0 grid grid-rows-[auto_1fr] overflow-hidden',
            panelPosition === 'bottom' && tab !== 'console' && 'hidden'
          )}
          style={panelPosition === 'left' ? { height: panelHeightPercentages[0] + '%' } : {}}
        >
          <SidePanelHeader codeEditorPanelData={codeEditorPanelData}>Console</SidePanelHeader>
          <ConsoleOutput {...props} />
        </TabsContent>

        <TabsContent
          forceMount={true}
          value="ai-assistant"
          className={cn(
            'm-0 grid overflow-hidden',
            panelPosition === 'bottom' && 'grid-rows-[1fr_auto]',
            panelPosition === 'left' && 'grid grid-rows-[auto_1fr_auto]',
            panelPosition === 'bottom' && tab !== 'ai-assistant' && 'hidden'
          )}
          style={
            panelPosition === 'left'
              ? {
                  height: panelHeightPercentages[1] + '%',
                }
              : {}
          }
        >
          <SidePanelHeader codeEditorPanelData={codeEditorPanelData}>AI assistant</SidePanelHeader>

          {isAuthenticated ? (
            <AiAssistant
              // todo: fix this
              evalResult={evaluationResult}
              editorMode={editorMode}
              editorContent={editorContent}
              isActive={tab === 'ai-assistant'}
            />
          ) : (
            <Type className="px-3">
              You need to{' '}
              <a href={ROUTES.LOGIN} className="underline hover:text-primary">
                log in to Quadratic
              </a>{' '}
              to use the AI assistant.
            </Type>
          )}
        </TabsContent>

        {isConnection && (
          <TabsContent
            forceMount={true}
            value="data-browser"
            className={cn(
              'm-0 grid grid-rows-[auto_1fr] overflow-hidden',
              panelPosition === 'bottom' && tab !== 'data-browser' && 'hidden'
            )}
            style={panelPosition === 'left' ? { height: panelHeightPercentages[2] + '%' } : {}}
          >
            <SidePanelHeader codeEditorPanelData={codeEditorPanelData}>Data browser</SidePanelHeader>
            {/* TODO: (connections) permissions */}
            <SchemaViewer />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}

function SidePanelHeader({
  codeEditorPanelData,
  children,
}: {
  codeEditorPanelData: CodeEditorPanelData;
  children: React.ReactNode;
}) {
  return codeEditorPanelData.panelPosition === 'left' ? (
    <Type className={'gap-2 px-3 py-3 pb-2 font-medium'}>{children}</Type>
  ) : null;
}

export function ConsoleOutput({
  consoleOutput,
  editorMode,
  editorContent,
  evaluationResult,
  spillError,
}: ConsoleProps) {
  let hasOutput = Boolean(consoleOutput?.stdErr?.length || consoleOutput?.stdOut?.length || spillError);
  return (
    <div
      contentEditable={hasOutput}
      suppressContentEditableWarning={true}
      spellCheck={false}
      onKeyDown={(e) => {
        if (((e.metaKey || e.ctrlKey) && e.key === 'a') || ((e.metaKey || e.ctrlKey) && e.key === 'c')) {
          // Allow a few commands, but nothing else
        } else {
          e.preventDefault();
        }
      }}
      className="overflow-y-auto whitespace-pre-wrap pl-3 pr-4 outline-none"
      style={codeEditorBaseStyles}
      // Disable Grammarly
      data-gramm="false"
      data-gramm_editor="false"
      data-enable-grammarly="false"
    >
      {hasOutput ? (
        <>
          {spillError && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.error }}>
              SPILL ERROR: Array output could not expand because it would overwrite existing content. To fix this,
              remove content in cell
              {spillError.length > 1 ? 's' : ''}{' '}
              {spillError.map(
                (pos, index) =>
                  `(${pos.x}, ${pos.y})${
                    index !== spillError.length - 1 ? (index === spillError.length - 2 ? ', and ' : ', ') : '.'
                  }`
              )}
            </span>
          )}
          {consoleOutput?.stdErr && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.error }}>
              ERROR: {consoleOutput?.stdErr}
            </span>
          )}
          {consoleOutput?.stdOut}
        </>
      ) : (
        <div className="mt-1" style={{ ...codeEditorCommentStyles }}>
          {editorMode === 'Python'
            ? 'Print statements, standard out, and errors will show here.'
            : 'Errors will show here.'}
        </div>
      )}
    </div>
  );
}
