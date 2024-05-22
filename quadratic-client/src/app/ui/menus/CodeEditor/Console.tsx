import { Coordinate } from '@/app/gridGL/types/size';
import { SchemaViewer } from '@/app/ui/connections/SchemaViewer';
import type { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { useRootRouteLoaderData } from '@/routes/index';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { cn } from '@/shared/shadcn/utils';
import { ViewStreamOutlined } from '@mui/icons-material';
import { useState } from 'react';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { colors } from '../../../theme/colors';
import { AiAssistant } from './AiAssistant';
import { PanelPosition } from './CodeEditor';
import { codeEditorBaseStyles, codeEditorCommentStyles } from './styles';

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

type Tab = 'console' | 'ai-assistant' | 'schema';

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
        <div className={cn(panelPosition !== 'bottom' && 'hidden', 'px-3 pb-2 pt-2')}>
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
            {/* TODO: (connections) if it's sql */}
            <TabsTrigger value="schema">Data browser</TabsTrigger>
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
            <Type className={cn('flex items-center gap-2 px-3 py-3', consoleBadgeSharedClasses)}>Console</Type>
          )}
          <ConsoleOutput {...props} />
        </TabsContent>
        <TabsContent
          forceMount={true}
          value="ai-assistant"
          className={cn(
            'm-0 grid overflow-hidden',
            panelPosition === 'bottom' && 'grid-rows-[1fr_auto]',
            panelPosition === 'left' && 'grid grid-rows-[auto_1fr_auto]'
          )}
          style={panelPosition === 'left' ? { height: `${100 - panelHeightPercentage - 30}%` } : {}}
        >
          {panelPosition === 'left' && (
            <Type className={cn(`gap-2 px-3 py-3`, consoleBadgeSharedClasses)}>AI assistant</Type>
          )}

          {isAuthenticated ? (
            <AiAssistant
              // todo: fix this
              evalResult={evaluationResult}
              editorMode={editorMode}
              editorContent={editorContent}
              isActive={true}
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

        <TabsContent
          forceMount={true}
          value="schema"
          className={cn(
            'm-0 grid grid-rows-[auto_1fr] overflow-hidden',
            panelPosition === 'bottom' && tab !== 'schema' && 'hidden'
          )}
          style={panelPosition === 'left' ? { height: `${panelHeightPercentage}%` } : {}}
        >
          {/* Only visible when panel is on the left */}
          {panelPosition === 'left' && (
            <Type className={cn('flex items-center gap-2 px-3 py-3', consoleBadgeSharedClasses)}>Data browser</Type>
          )}

          <SchemaViewer />
        </TabsContent>
      </Tabs>

      <Tabs
        className={cn('absolute', panelPosition === 'bottom' ? 'right-2 top-2' : 'right-2 top-2')}
        value={panelPosition}
        onValueChange={(e) => {
          setPanelPosition((prev: PanelPosition) => (prev === 'left' ? 'bottom' : 'left'));
        }}
      >
        <TabsList className={panelPosition === 'left' ? 'h-8 py-0.5' : ''}>
          <TabsTrigger value="bottom" className={panelPosition === 'left' ? 'py-0.5' : ''}>
            <ViewStreamOutlined fontSize="small" />
          </TabsTrigger>
          <TabsTrigger value="left" className={panelPosition === 'left' ? 'py-0.5' : ''}>
            <ViewStreamOutlined fontSize="small" className="rotate-90" />
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
