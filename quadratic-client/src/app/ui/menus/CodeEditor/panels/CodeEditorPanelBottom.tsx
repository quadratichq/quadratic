import { ChevronRightIcon } from '@radix-ui/react-icons';

import { SchemaViewer } from '@/app/ui/components/SchemaViewer';
import { AiAssistant } from '@/app/ui/menus/CodeEditor/AiAssistant';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import type { CodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { Button } from '@/shared/shadcn/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { cn } from '@/shared/shadcn/utils';

export type PanelTab = 'console' | 'ai-assistant' | 'data-browser';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
  showSchemaViewer: boolean;
  showAiAssistant: boolean;
}

export function CodeEditorPanelBottom({
  codeEditorPanelData: { bottomHidden, setBottomHidden },
  showSchemaViewer,
  showAiAssistant,
}: Props) {
  const {
    consoleOutput: [consoleOutput],
    panelBottomActiveTab: [tab, setTab],
    spillError: [spillError],
  } = useCodeEditor();
  const hasOutput = Boolean(consoleOutput?.stdErr?.length || consoleOutput?.stdOut?.length || spillError);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        setTab(value as PanelTab);
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
          <TabsTrigger
            value="console"
            className={cn(
              `relative font-medium after:absolute after:right-1 after:top-4`,
              // Special indicators when the console isn't active and there's output
              tab !== 'console' && hasOutput && `after:h-[4px] after:w-[4px] after:rounded-full after:content-['']`,
              tab !== 'console' && consoleOutput?.stdErr ? 'after:bg-destructive' : 'after:bg-muted-foreground'
            )}
          >
            Console
          </TabsTrigger>
          {showSchemaViewer && <TabsTrigger value="data-browser">Schema</TabsTrigger>}
          {showAiAssistant && <TabsTrigger value="ai-assistant">AI Assistant</TabsTrigger>}
        </TabsList>
      </div>

      <TabsContent value="console" className="m-0 grow overflow-hidden">
        {!bottomHidden && (
          <div className="h-full pt-2">
            <Console />
          </div>
        )}
      </TabsContent>

      {showAiAssistant && (
        <TabsContent value="ai-assistant" className="m-0 grow overflow-hidden">
          {!bottomHidden && <AiAssistant autoFocus={true} />}
        </TabsContent>
      )}

      {showSchemaViewer && (
        <TabsContent value="data-browser" className="m-0 grow overflow-hidden">
          {!bottomHidden && <SchemaViewer bottom />}
        </TabsContent>
      )}
    </Tabs>
  );
}
