import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { codeEditorAtom, codeEditorCodeCellAtom, codeEditorEditorContentAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { CodeSnippet } from '@/app/ui/menus/CodeEditor/AIAssistant/CodeSnippet';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { SaveAndRunIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { CodeIcon } from '@radix-ui/react-icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { useEffect, useMemo, useState } from 'react';
import { useRecoilCallback, useRecoilValue } from 'recoil';
import type { z } from 'zod';

type UpdateCodeCellResponse = z.infer<(typeof aiToolsSpec)[AITool.UpdateCodeCell]['responseSchema']>;

type UpdateCodeCellProps = {
  args: string;
  loading: boolean;
};

export const UpdateCodeCell = ({ args, loading }: UpdateCodeCellProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<UpdateCodeCellResponse, UpdateCodeCellResponse>>();
  const editorContent = useRecoilValue(codeEditorEditorContentAtom);
  const codeCell = useRecoilValue(codeEditorCodeCellAtom);
  const [showCode, setShowCode] = useState(false);

  const handleSaveAndRun = useRecoilCallback(
    ({ snapshot, set }) =>
      async () => {
        if (!toolArgs?.data) {
          return;
        }

        const { code_string } = toolArgs.data;
        const editorContent = await snapshot.getPromise(codeEditorEditorContentAtom);
        if (editorContent === code_string) {
          return;
        }

        const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);

        set(codeEditorAtom, (prev) => ({
          ...prev,
          diffEditorContent: { editorContent, isApplied: true },
          waitingForEditorClose: {
            codeCell,
            showCellTypeMenu: false,
            initialCode: code_string,
            inlineEditor: false,
          },
        }));

        quadraticCore.setCodeCellValue({
          sheetId: codeCell.sheetId,
          x: codeCell.pos.x,
          y: codeCell.pos.y,
          codeString: code_string ?? '',
          language: codeCell.language,
          cursor: sheets.getCursorPosition(),
        });
      },
    [toolArgs]
  );

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.UpdateCodeCell].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[UpdateCodeCell] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const estimatedNumberOfLines = useMemo(() => {
    if (toolArgs) {
      return toolArgs.data?.code_string.split('\n').length;
    } else {
      return args.split('\\n').length;
    }
  }, [toolArgs, args]);

  if (loading) {
    return (
      <ToolCard
        icon={<LanguageIcon language={getLanguage(codeCell.language)} />}
        label={getLanguage(codeCell.language)}
        description={`${estimatedNumberOfLines} line` + (estimatedNumberOfLines === 1 ? '' : 's')}
        isLoading={true}
      />
    );
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={<LanguageIcon language="" />} label="Code" hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard isLoading />;
  }

  return (
    <div>
      <ToolCard
        icon={<LanguageIcon language={getLanguage(codeCell.language)} />}
        label={getLanguage(codeCell.language)}
        description={`${estimatedNumberOfLines} line` + (estimatedNumberOfLines === 1 ? '' : 's')}
        actions={
          editorContent !== toolArgs.data.code_string && (
            <div className="flex gap-1">
              <TooltipPopover label={'Show code'}>
                <Button size="icon-sm" variant="ghost" onClick={() => setShowCode(!showCode)}>
                  <CodeIcon />
                </Button>
              </TooltipPopover>

              <TooltipPopover label={'Apply'}>
                <Button size="icon-sm" variant="ghost" onClick={handleSaveAndRun}>
                  <SaveAndRunIcon />
                </Button>
              </TooltipPopover>
            </div>
          )
        }
      />

      {showCode && <CodeSnippet code={toolArgs.data.code_string} language={getLanguage(codeCell.language)} />}
    </div>
  );
};
