import { AITool } from '@/app/ai/tools/aiTools';
import { aiToolsSpec } from '@/app/ai/tools/aiToolsSpec';
import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { stringToSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { ToolCard } from '@/app/ui/menus/AIAnalyst/toolCards/ToolCard';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { CodeIcon, SaveAndRunIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { OBJ, parse, STR } from 'partial-json';
import { useEffect, useState } from 'react';
import { useRecoilCallback } from 'recoil';
import type { z } from 'zod';

type SetCodeCellValueResponse = z.infer<(typeof aiToolsSpec)[AITool.SetCodeCellValue]['responseSchema']>;

type SetCodeCellValueProps = {
  args: string;
  loading: boolean;
};

export const SetCodeCellValue = ({ args, loading }: SetCodeCellValueProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<SetCodeCellValueResponse, SetCodeCellValueResponse>>();
  const [codeCellPos, setCodeCellPos] = useState<JsCoordinate | undefined>();

  useEffect(() => {
    if (!loading) {
      const fullJson = parseFullJson(args);
      if (fullJson) {
        const toolArgs = aiToolsSpec[AITool.SetCodeCellValue].responseSchema.safeParse(fullJson);
        setToolArgs(toolArgs);

        if (toolArgs.success) {
          try {
            const selection = stringToSelection(toolArgs.data.code_cell_position, sheets.current, sheets.a1Context);
            const { x, y } = selection.getCursor();
            setCodeCellPos({ x, y });
          } catch (e) {
            console.error('[SetCodeCellValue] Failed to parse args: ', e);
            setCodeCellPos(undefined);
          }
        }
      } else {
        setToolArgs(undefined);
      }
    }
  }, [args, loading]);

  const openDiffInEditor = useRecoilCallback(
    ({ set }) =>
      (toolArgs: SetCodeCellValueResponse) => {
        if (!codeCellPos) {
          return;
        }

        set(codeEditorAtom, (prev) => ({
          ...prev,
          diffEditorContent: { editorContent: toolArgs.code_string, isApplied: false },
          waitingForEditorClose: {
            codeCell: {
              sheetId: sheets.current,
              pos: codeCellPos,
              language: toolArgs.code_cell_language,
            },
            showCellTypeMenu: false,
            inlineEditor: false,
            initialCode: '',
          },
        }));
      },
    [codeCellPos]
  );

  const saveAndRun = useRecoilCallback(
    () => (toolArgs: SetCodeCellValueResponse) => {
      if (!codeCellPos) {
        return;
      }

      quadraticCore.setCodeCellValue({
        sheetId: sheets.current,
        x: codeCellPos.x,
        y: codeCellPos.y,
        codeString: toolArgs.code_string,
        language: toolArgs.code_cell_language,
        cursor: sheets.getCursorPosition(),
      });
    },
    [codeCellPos]
  );

  if (loading) {
    const partialJson = parsePartialJson(args);
    if (partialJson && 'code_cell_language' in partialJson) {
      const estimatedNumberOfLines = args.split('\\n').length;
      const { code_cell_language: language, code_cell_position: position } = partialJson;
      return (
        <ToolCard
          icon={<LanguageIcon language={language} />}
          label={language}
          description={
            `${estimatedNumberOfLines} line` +
            (estimatedNumberOfLines === 1 ? '' : 's') +
            (position ? ` at ${position}` : '')
          }
          isLoading={true}
        />
      );
    }
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={<LanguageIcon language="" />} label="Code" hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard isLoading />;
  }

  const { code_cell_language, code_cell_position, code_string } = toolArgs.data;
  const estimatedNumberOfLines = code_string.split('\n').length;
  return (
    <ToolCard
      icon={<LanguageIcon language={code_cell_language} />}
      label={code_cell_language}
      description={
        `${estimatedNumberOfLines} line` + (estimatedNumberOfLines === 1 ? '' : 's') + ` at ${code_cell_position}`
      }
      actions={
        codeCellPos ? (
          <div className="flex gap-1">
            <TooltipPopover label={'Open diff in editor'}>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => openDiffInEditor(toolArgs.data)}
                disabled={!codeCellPos}
              >
                <CodeIcon />
              </Button>
            </TooltipPopover>

            <TooltipPopover label={'Apply'}>
              <Button size="icon-sm" variant="ghost" onClick={() => saveAndRun(toolArgs.data)} disabled={!codeCellPos}>
                <SaveAndRunIcon />
              </Button>
            </TooltipPopover>
          </div>
        ) : undefined
      }
    />
  );
};

const parsePartialJson = (args: string): Partial<SetCodeCellValueResponse> | null => {
  try {
    const parsed = parse(args, STR | OBJ);
    return parsed;
  } catch (error) {
    return null;
  }
};

const parseFullJson = (args: string): Partial<SetCodeCellValueResponse> | null => {
  try {
    const json = JSON.parse(args);
    return json;
  } catch (error) {
    console.error('[SetCodeCellValue] Failed to parse args: ', error);
    return null;
  }
};
