import { codeCellIsAConnection } from '@/app/helpers/codeCellLanguage';
import { SchemaViewer } from '@/app/ui/connections/SchemaViewer';
import { AiAssistant } from '@/app/ui/menus/CodeEditor/AiAssistant';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { cn } from '@/shared/shadcn/utils';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';

export type PanelTab = 'console' | 'ai-assistant' | 'data-browser';

export function CodeEditorPanelBottom() {
  const {
    consoleOutput: [consoleOutput],
    panelBottomActiveTab: [tab, setTab],
    spillError: [spillError],
  } = useCodeEditor();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const hasOutput = Boolean(consoleOutput?.stdErr?.length || consoleOutput?.stdOut?.length || spillError);
  const isConnection = codeCellIsAConnection(editorInteractionState.mode);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        setTab(value as PanelTab);
      }}
      className={'grid h-full grid-rows-[auto_1fr]'}
    >
      <div className={'px-2 pb-2 pt-2'}>
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
          <TabsTrigger value="ai-assistant">AI assistant</TabsTrigger>
          {/* TODO: (connections) if it's sql and you have permission */}
          {isConnection && <TabsTrigger value="data-browser">Data browser</TabsTrigger>}
        </TabsList>
      </div>

      <TabsContent value="console" className={cn('m-0 grid grid-rows-[auto_1fr] overflow-hidden')}>
        <Console />
      </TabsContent>

      <TabsContent value="ai-assistant" className={cn('m-0 grid grid-rows-[1fr_auto] overflow-hidden')}>
        <AiAssistant autoFocus={true} />
      </TabsContent>

      {isConnection && (
        <TabsContent value="data-browser" className={cn('m-0 grid grid-rows-[auto_1fr] overflow-hidden')}>
          {/* TODO: (connections) permissions */}
          <SchemaViewer />
        </TabsContent>
      )}
    </Tabs>
  );
}
