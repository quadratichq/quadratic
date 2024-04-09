import { useEffect, useRef, useState } from 'react';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
// import { CodeCellRunOutput, CodeCellValue } from '../../../quadratic-core/types';
import { Coordinate } from '@/gridGL/types/size';
import { useRootRouteLoaderData } from '@/router';
import type { EvaluationResult } from '@/web-workers/pythonWebWorker/pythonTypes';
import { colors } from '../../../theme/colors';
import { codeEditorBaseStyles, codeEditorCommentStyles } from './styles';

import { Type } from '@/components/Type';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shadcn/ui/tabs';
import { cn } from '@/shadcn/utils';
import { AutoAwesome, TerminalOutlined, ViewStreamOutlined } from '@mui/icons-material';
import { AITab } from './AITab';
import { PanelPosition } from './CodeEditor';

interface ConsoleProps {
  consoleOutput?: { stdOut?: string; stdErr?: string };
  editorMode: EditorInteractionState['mode'];
  editorContent: string | undefined;
  evaluationResult?: EvaluationResult;
  spillError?: Coordinate[];
  children: any;
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
    children,
    editorWidth,
    secondPanelWidth,
    secondPanelHeightPercentage,
  } = props;
  const { isAuthenticated } = useRootRouteLoaderData();
  let hasOutput = Boolean(consoleOutput?.stdErr?.length || consoleOutput?.stdOut?.length || spillError);
  const [tab, setTab] = useState<Tab>('console');

  const consoleBadgeSharedClasses = cn(
    `font-medium`,
    hasOutput && `after:h-[5px] after:w-[5px] after:rounded-full after:content-['']`,
    consoleOutput?.stdErr ? 'after:bg-destructive' : 'after:bg-muted-foreground'
  );

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
              className={cn(`relative after:absolute after:right-1 after:top-1`, consoleBadgeSharedClasses)}
            >
              Console
            </TabsTrigger>
            <TabsTrigger value="ai-assistant">AI Assitant</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          forceMount={true}
          value="console"
          className={cn(
            'm-0 grid grid-rows-[auto_1fr] overflow-hidden',
            panelPosition === 'bottom' && tab !== 'console' && 'hidden'
          )}
          style={panelPosition === 'left' ? { height: `${secondPanelHeightPercentage}%` } : {}}
        >
          {/* Only visible when panel is on the left */}
          {panelPosition === 'left' && (
            <div className="flex items-center gap-2 px-2 py-3">
              <TerminalOutlined className="text-foreground" fontSize="small" />
              <Type className={cn('flex items-center gap-2 ', consoleBadgeSharedClasses)}>Console</Type>
            </div>
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
          style={panelPosition === 'left' ? { height: `${100 - secondPanelHeightPercentage}%` } : {}}
        >
          {panelPosition === 'left' && (
            <div className="flex items-center gap-2 px-2 py-3">
              <AutoAwesome className="text-foreground" fontSize="small" />
              <Type className="font-medium">AI assistant</Type>
            </div>
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
            'you need an account to use the AI assistant'
          )}
        </TabsContent>
      </Tabs>

      {/* <div
        className={cn(`grid grid-rows-[auto_1fr] overflow-hidden`, panelPosition === 'bottom' && 'hidden')}
        style={{ height: `${secondPanelHeightPercentage}%` }}
      ></div>

      <div
        className={cn(`grid grid-rows-[auto_1fr] overflow-hidden`, panelPosition === 'bottom' && 'hidden')}
        style={{ height: `${100 - secondPanelHeightPercentage}%` }}
      ></div> */}

      <PanelToggle panelPosition={panelPosition} setPanelPosition={setPanelPosition} />
    </>
  );
}

/* <PanelPane>
        <TabPanel value={activeTabIndex} index={0}>
          
        </TabPanel>
        <TabPanel value={activeTabIndex} index={1} scrollToBottom={true}>
          <AITab
            // todo: fix this
            evalResult={evaluationResult}
            editorMode={editorMode}
            editorContent={editorContent}
            isActive={activeTabIndex === 1}
          ></AITab>
        </TabPanel>
      </PanelPane> */

export function PanelPane({ children }: { children: React.ReactNode }) {
  return <div style={{ flex: '2', overflow: 'scroll', fontSize: '.875rem', lineHeight: '1.5' }}>{children}</div>;
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
      contentEditable="true"
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

function TabPanel(props: { children: React.ReactElement; value: number; index: number; scrollToBottom?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { children, value, index, scrollToBottom, ...other } = props;
  const hidden = value !== index;

  useEffect(() => {
    if (!ref.current || hidden) return;

    if (scrollToBottom) {
      ref.current.scrollIntoView(false);
    } else {
      ref.current.scrollIntoView(true);
    }
  }, [hidden, scrollToBottom]);

  return (
    <div
      ref={ref}
      role="tabpanel"
      hidden={hidden}
      id={`console-tabpanel-${index}`}
      aria-labelledby={`console-tab-${index}`}
      {...other}
    >
      {/* {value === index && ( */}
      <div style={{ padding: '.5rem 1rem 0 1rem' }}>{children}</div>
      {/* )} */}
    </div>
  );
}

export function PanelToggle({
  panelPosition,
  setPanelPosition,
}: {
  panelPosition: PanelPosition;
  setPanelPosition: React.Dispatch<React.SetStateAction<PanelPosition>>;
}) {
  return (
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
  );
}
