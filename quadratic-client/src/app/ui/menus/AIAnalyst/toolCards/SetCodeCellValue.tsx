import { AITool } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { CodeIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { OBJ, parse, STR } from 'partial-json';
import { useEffect, useState } from 'react';
import { useRecoilCallback } from 'recoil';
import { z } from 'zod';

type SetCodeCellValueResponse = z.infer<(typeof aiToolsSpec)[AITool.SetCodeCellValue]['responseSchema']>;

type SetCodeCellValueProps = {
  args: string;
  loading: boolean;
};

const className =
  'mx-2 my-1 flex items-center justify-between gap-2 rounded border border-border bg-background p-2 text-sm shadow';

export const SetCodeCellValue = ({ args, loading }: SetCodeCellValueProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<SetCodeCellValueResponse, SetCodeCellValueResponse>>();

  useEffect(() => {
    if (!loading) {
      const fullJson = parseFullJson(args);
      if (fullJson) {
        setToolArgs(aiToolsSpec[AITool.SetCodeCellValue].responseSchema.safeParse(fullJson));
      } else {
        setToolArgs(undefined);
      }
    }
  }, [args, loading]);

  const openDiffInCodeEditor = useRecoilCallback(
    ({ set }) =>
      (toolArgs: SetCodeCellValueResponse) => {
        set(codeEditorAtom, (prev) => ({
          ...prev,
          diffEditorContent: { editorContent: toolArgs.codeString, isApplied: false },
          waitingForEditorClose: {
            codeCell: {
              sheetId: sheets.current,
              pos: { x: toolArgs.x, y: toolArgs.y },
              language: toolArgs.language,
            },
            showCellTypeMenu: false,
            inlineEditor: false,
            initialCode: '',
          },
        }));
      },
    []
  );

  if (loading) {
    const partialJson = parsePartialJson(args);
    if (partialJson && 'language' in partialJson) {
      const estimatedNumberOfLines = args.split('\\n').length;
      return (
        <SetCodeCellValueLoadingCard
          language={partialJson.language}
          lines={estimatedNumberOfLines}
          x={partialJson.x}
          y={partialJson.y}
        />
      );
    }
  }

  if (!toolArgs || !toolArgs.data) {
    return <div className={className}>Loading...</div>;
  } else if (!toolArgs.success) {
    return <div className={className}>Something went wrong</div>;
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <LanguageIcon language={toolArgs.data.language} />

        <span className="font-bold">{`${toolArgs.data.language} (${toolArgs.data.x}, ${toolArgs.data.y})`}</span>
      </div>

      <TooltipPopover label={'Show diff in code editor'}>
        <Button size="icon-sm" variant="ghost" onClick={() => openDiffInCodeEditor(toolArgs.data)}>
          <CodeIcon />
        </Button>
      </TooltipPopover>
    </div>
  );
};

type SetCodeCellValueLoadingProps = {
  language: string;
  lines: number;
  x?: number;
  y?: number;
};

const SetCodeCellValueLoadingCard = ({ language, lines, x, y }: SetCodeCellValueLoadingProps) => {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <LanguageIcon language={language} />

        <span className="font-bold">{`Loading ${language} - ${lines} lines${x && y ? ` for (${x}, ${y})` : ''}`}</span>
      </div>
    </div>
  );
};

const parsePartialJson = (args: string) => {
  try {
    const parsed = parse(args, STR | OBJ);
    return parsed;
  } catch (error) {
    return null;
  }
};

const parseFullJson = (args: string) => {
  try {
    const json = JSON.parse(args);
    return json;
  } catch (error) {
    console.error('[SetCodeCellValue] Failed to parse args: ', error);
  }
};
