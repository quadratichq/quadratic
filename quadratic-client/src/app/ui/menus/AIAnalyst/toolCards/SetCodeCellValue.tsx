import { AITool } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { CodeIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { useMemo } from 'react';
import { useRecoilCallback } from 'recoil';
import { z } from 'zod';

type SetCodeCellValueProps = {
  args: string;
  loading: boolean;
};

export const SetCodeCellValue = ({ args, loading }: SetCodeCellValueProps) => {
  const openInCodeEditor = useRecoilCallback(
    ({ set }) =>
      (toolArgs: z.infer<(typeof aiToolsSpec)[AITool.SetCodeCellValue]['responseSchema']>) => {
        set(codeEditorAtom, (prev) => ({
          ...prev,
          modifiedEditorContent: undefined,
          waitingForEditorClose: {
            codeCell: {
              sheetId: sheets.current,
              pos: { x: toolArgs.x, y: toolArgs.y },
              language: toolArgs.language,
            },
            showCellTypeMenu: false,
            inlineEditor: false,
            initialCode: toolArgs.codeString,
          },
        }));
      },
    []
  );

  const toolArgs = useMemo(() => {
    try {
      const argsObject = JSON.parse(args);
      return aiToolsSpec[AITool.SetCodeCellValue].responseSchema.safeParse(argsObject);
    } catch (error) {
      console.error('[SetCodeCellValue] Failed to parse args: ', error);
      return { success: false, error, data: undefined };
    }
  }, [args]);

  if (loading) {
    return <div className="flex items-center">Loading SetCodeCellValue...</div>;
  }

  if (!toolArgs.success || !toolArgs.data) {
    return <div className="flex items-center">Error in SetCodeCellValue</div>;
  }

  return (
    <div className="mx-2 my-1 flex items-center justify-between gap-2 rounded border border-border bg-background p-2 text-sm shadow">
      <div className="flex items-center gap-2">
        <LanguageIcon language={toolArgs.data.language} />

        <span className="font-bold">{`Inserted ${toolArgs.data.language} in (${toolArgs.data.x}, ${toolArgs.data.y})`}</span>
      </div>

      <TooltipPopover label={'Open in code editor'}>
        <Button size="icon-sm" variant="ghost" onClick={() => openInCodeEditor(toolArgs.data)}>
          <CodeIcon />
        </Button>
      </TooltipPopover>
    </div>
  );
};
