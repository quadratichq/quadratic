import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { codeCellIsAConnection } from '@/app/helpers/codeCellLanguage';
import { SchemaViewer } from '@/app/ui/components/SchemaViewer';
import { AiAssistant } from '@/app/ui/menus/CodeEditor/AiAssistant';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Button } from '@/shared/shadcn/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { cn } from '@/shared/shadcn/utils';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { useRecoilValue } from 'recoil';
import { CodeEditorPanelData } from './useCodeEditorPanelData';

export type PanelTab = 'console' | 'ai-assistant' | 'data-browser';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
}

export function CodeEditorPanelBottom(props: Props) {
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    consoleOutput: [consoleOutput],
    panelBottomActiveTab: [tab, setTab],
    spillError: [spillError],
  } = useCodeEditor();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const hasOutput = Boolean(consoleOutput?.stdErr?.length || consoleOutput?.stdOut?.length || spillError);
  const isConnection = codeCellIsAConnection(editorInteractionState.mode);

  const { bottomHidden, setBottomHidden } = props.codeEditorPanelData;

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
          {isAuthenticated && <TabsTrigger value="ai-assistant">AI assistant</TabsTrigger>}
          {isAuthenticated && isConnection && <TabsTrigger value="data-browser">Data browser</TabsTrigger>}
        </TabsList>
      </div>

      <TabsContent value="console" className="m-0 block grow overflow-scroll">
        {!bottomHidden && <Console />}
      </TabsContent>

      {isAuthenticated && (
        <TabsContent value="ai-assistant" className="m-0 block grow overflow-scroll">
          {!bottomHidden && <AiAssistant autoFocus={true} />}
        </TabsContent>
      )}

      {isAuthenticated && isConnection && (
        <TabsContent value="data-browser" className="m-0 block grow overflow-scroll">
          {/* TODO: (connections) permissions */}
          {!bottomHidden && <SchemaViewer bottom />}
        </TabsContent>
      )}
    </Tabs>
  );
}
