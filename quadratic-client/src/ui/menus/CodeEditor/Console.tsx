import { useState } from 'react';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
// import { CodeCellRunOutput, CodeCellValue } from '../../../quadratic-core/types';
import { Coordinate } from '@/gridGL/types/size';
import { useRootRouteLoaderData } from '@/router';
import type { EvaluationResult } from '@/web-workers/pythonWebWorker/pythonTypes';
import { colors } from '../../../theme/colors';
import { codeEditorBaseStyles, codeEditorCommentStyles } from './styles';

import { Type } from '@/components/Type';
import { ROUTES } from '@/constants/routes';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shadcn/ui/tabs';
import { cn } from '@/shadcn/utils';
import { ViewStreamOutlined } from '@mui/icons-material';
import { AITab } from './AITab';
import { PanelPosition } from './CodeEditor';

interface ConsoleProps {
  consoleOutput?: { stdOut?: string; stdErr?: string };
  editorMode: EditorInteractionState['mode'];
  editorContent: string | undefined;
  evaluationResult?: EvaluationResult;
  spillError?: Coordinate[];
  panelPosition: PanelPosition;
  panelHeightPercentage: number;
  setPanelPosition: React.Dispatch<React.SetStateAction<PanelPosition>>;
}

type Tab = 'console' | 'ai-assistant';

export function Console(props: ConsoleProps) {
  const {
    consoleOutput,
    editorMode,
    editorContent,
    evaluationResult,
    spillError,
    panelPosition,
    setPanelPosition,
    panelHeightPercentage,
  } = props;
  const { isAuthenticated } = useRootRouteLoaderData();
  const hasOutput = Boolean(consoleOutput?.stdErr?.length || consoleOutput?.stdOut?.length || spillError);
  const [tab, setTab] = useState<Tab>('console');

  const consoleBadgeSharedClasses = `font-medium`;

  return (
    <>
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
                hasOutput && `after:h-[5px] after:w-[5px] after:rounded-full after:content-['']`,
                consoleOutput?.stdErr ? 'after:bg-destructive' : 'after:bg-muted-foreground'
              )}
            >
              Console
            </TabsTrigger>
            <TabsTrigger value="ai-assistant">AI assistant</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          forceMount={true}
          value="console"
          className={cn(
            'm-0 grid grid-rows-[auto_1fr] overflow-hidden',
            panelPosition === 'bottom' && tab !== 'console' && 'hidden'
          )}
          style={panelPosition === 'left' ? { height: `${panelHeightPercentage}%` } : {}}
        >
          {/* Only visible when panel is on the left */}
          {panelPosition === 'left' && (
            <Type className={cn('flex items-center gap-2 px-2 py-3', consoleBadgeSharedClasses)}>Console</Type>
          )}
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
          style={panelPosition === 'left' ? { height: `${100 - panelHeightPercentage}%` } : {}}
        >
          {panelPosition === 'left' && (
            <Type className={cn(`gap-2 px-2 py-3`, consoleBadgeSharedClasses)}>AI assistant</Type>
          )}

          {isAuthenticated ? (
            <AITab
              // todo: fix this
              evalResult={evaluationResult}
              editorMode={editorMode}
              editorContent={editorContent}
              isActive={true}
            />
          ) : (
            <Type className="px-2">
              You need to{' '}
              <a href={ROUTES.LOGIN} className="underline hover:text-primary">
                log in to Quadratic
              </a>{' '}
              to use the AI assistant.
            </Type>
          )}
        </TabsContent>
      </Tabs>

      <Tabs
        className={cn('absolute', panelPosition === 'bottom' ? 'right-2 top-2' : 'right-1 top-1')}
        value={panelPosition}
        onValueChange={(e) => {
          setPanelPosition((prev: PanelPosition) => (prev === 'left' ? 'bottom' : 'left'));
        }}
      >
        <TabsList>
          <TabsTrigger value="bottom" className="group relative">
            <ViewStreamOutlined className="" fontSize="small" style={{}} />
          </TabsTrigger>
          <TabsTrigger value="left">
            <ViewStreamOutlined className="rotate-90" fontSize="small" style={{}} />
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </>
  );
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
      className="overflow-scroll whitespace-pre-wrap pl-2 pr-4 outline-none"
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
