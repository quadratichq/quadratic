import { SchemaViewer } from '@/app/ui/components/SchemaViewer';
import { AiAssistant } from '@/app/ui/menus/CodeEditor/AiAssistant';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import { Button } from '@/shared/shadcn/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { cn } from '@/shared/shadcn/utils';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { CodeEditorPanelData } from './useCodeEditorPanelData';

export type PanelTab = 'console' | 'ai-assistant' | 'data-browser';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
  showDataBrowser: boolean;
  showAiAssistant: boolean;
}

export function CodeEditorPanelBottom({
  codeEditorPanelData: { bottomHidden, setBottomHidden },
  showDataBrowser,
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
      }}
      className={'grid h-full grid-rows-[auto_1fr]'}
    >
      <div className={'flex items-center px-2 pb-2 pt-2'}>
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
              `relative font-medium after:absolute after:right-1 after:top-1`,
              // Special indicators when the console isn't active and there's output
              tab !== 'console' && hasOutput && `after:h-[5px] after:w-[5px] after:rounded-full after:content-['']`,
              tab !== 'console' && consoleOutput?.stdErr ? 'after:bg-destructive' : 'after:bg-muted-foreground'
            )}
          >
            Console
          </TabsTrigger>
          {showAiAssistant && <TabsTrigger value="data-browser">Schema</TabsTrigger>}
          {showDataBrowser && <TabsTrigger value="ai-assistant">AI Assistant</TabsTrigger>}
        </TabsList>
      </div>

      <TabsContent value="console" className="m-0 block grow overflow-scroll">
        {!bottomHidden && <Console />}
      </TabsContent>

      {showAiAssistant && (
        <TabsContent value="ai-assistant" className="m-0 block grow overflow-scroll">
          {!bottomHidden && <AiAssistant autoFocus={true} />}
        </TabsContent>
      )}

      {showDataBrowser && (
        <TabsContent value="data-browser" className="m-0 block grow overflow-scroll">
          {!bottomHidden && <SchemaViewer bottom />}
        </TabsContent>
      )}
    </Tabs>
  );
}
