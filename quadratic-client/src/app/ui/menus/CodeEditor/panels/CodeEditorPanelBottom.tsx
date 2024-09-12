import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import { CodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { Button } from '@/shared/shadcn/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { cn } from '@/shared/shadcn/utils';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { ReactNode } from 'react';

export type PanelTab = 'console' | 'data-browser';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
  schemaBrowser: ReactNode | undefined;
}

export function CodeEditorPanelBottom({
  codeEditorPanelData: { bottomHidden, setBottomHidden },
  schemaBrowser,
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
          {schemaBrowser && <TabsTrigger value="data-browser">Schema</TabsTrigger>}
        </TabsList>
      </div>

      <TabsContent value="console" className="m-0 grow overflow-hidden">
        {!bottomHidden && (
          <div className="h-full pt-2">
            <Console />
          </div>
        )}
      </TabsContent>

      {schemaBrowser && (
        <TabsContent value="data-browser" className="m-0 grow overflow-hidden">
          {bottomHidden ? null : schemaBrowser}
        </TabsContent>
      )}
    </Tabs>
  );
}
