import {
  codeEditorConsoleOutputAtom,
  codeEditorPanelBottomActiveTabAtom,
  codeEditorSpillErrorAtom,
} from '@/app/atoms/codeEditorAtom';
import { AIAssistant } from '@/app/ui/menus/CodeEditor/AIAssistant/AIAssistant';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import { useCodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { Button } from '@/shared/shadcn/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { cn } from '@/shared/shadcn/utils';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { useMemo } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export type PanelTab = 'console' | 'ai-assistant' | 'data-browser';

interface CodeEditorPanelBottomProps {
  schemaBrowser: React.ReactNode | undefined;
  showAIAssistant: boolean;
}

export function CodeEditorPanelBottom({ schemaBrowser, showAIAssistant }: CodeEditorPanelBottomProps) {
  const { bottomHidden, setBottomHidden } = useCodeEditorPanelData();
  const consoleOutput = useRecoilValue(codeEditorConsoleOutputAtom);
  const spillError = useRecoilValue(codeEditorSpillErrorAtom);
  const [panelBottomActiveTab, setPanelBottomActiveTab] = useRecoilState(codeEditorPanelBottomActiveTabAtom);
  // const [showAIAnalyst, setShowAIAnalyst] = useRecoilState(showAIAnalystAtom);
  // const [, setAiAnalystPrompt] = useRecoilState(aiAnalystPromptAtom);
  const hasOutput = useMemo(
    () => Boolean(consoleOutput?.stdErr?.length || consoleOutput?.stdOut?.length || spillError),
    [consoleOutput?.stdErr?.length, consoleOutput?.stdOut?.length, spillError]
  );
  console.log('showAIAssistant', showAIAssistant);

  return (
    <Tabs
      value={panelBottomActiveTab}
      onValueChange={(value) => {
        setPanelBottomActiveTab(value as PanelTab);
        if (bottomHidden) {
          setBottomHidden((prev) => !prev);
        }
      }}
      className={'grid h-full grid-rows-[auto_1fr]'}
    >
      <div className={cn('flex select-none items-center px-2 pt-0.5', bottomHidden && 'border-t border-border')}>
        <Button variant={'link'} onClick={() => setBottomHidden(!bottomHidden)} className="mr-2 p-0">
          <ChevronRightIcon
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              !bottomHidden ? 'rotate-90' : ''
            )}
          />
        </Button>
        <TabsList>
          {!!schemaBrowser && <TabsTrigger value="data-browser">Schema</TabsTrigger>}
          <TabsTrigger
            value="console"
            className={cn(
              `relative font-medium after:absolute after:right-1 after:top-4`,
              // Special indicators when the console isn't active and there's output
              hasOutput && `after:h-[4px] after:w-[4px] after:rounded-full after:content-['']`,
              consoleOutput?.stdErr ? 'after:bg-destructive' : 'after:bg-muted-foreground'
            )}
          >
            Console
          </TabsTrigger>
          {showAIAssistant && <TabsTrigger value="ai-assistant">Code chat</TabsTrigger>}
        </TabsList>
        {/* <Button
          disabled={showAIAnalyst}
          variant="ghost"
          className="ml-auto"
          onClick={() => {
            setShowAIAnalyst(true);
            setAiAnalystPrompt((prev) => prev + '\nI want to focus on XXX');
          }}
        >
          Code chat
        </Button> */}
      </div>

      {!!schemaBrowser && (
        <TabsContent value="data-browser" className="m-0 grow overflow-hidden">
          {bottomHidden ? null : <>{schemaBrowser}</>}
        </TabsContent>
      )}

      {showAIAssistant && (
        <TabsContent value="ai-assistant" className="relative m-0 grow overflow-hidden">
          {!bottomHidden && <AIAssistant />}
        </TabsContent>
      )}

      <TabsContent value="console" className="m-0 grow overflow-hidden">
        {!bottomHidden && (
          <div className="h-full pt-2">
            <Console />
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
