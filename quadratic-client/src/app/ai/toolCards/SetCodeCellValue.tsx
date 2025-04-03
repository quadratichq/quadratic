import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { setCodeCellValueAndName } from '@/app/ai/tools/aiToolsActions';
import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { stringToSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { CodeIcon, SaveAndRunIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { useEffect, useMemo, useState } from 'react';
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

  // Process arguments - similar approach to AddDataTable component
  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        console.log('[SetCodeCellValue] Parsed args:', json);
        setToolArgs(aiToolsSpec[AITool.SetCodeCellValue].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[SetCodeCellValue] Failed to parse args: ', error);
      }
    }
  }, [args, loading]);

  // Extract position when toolArgs changes
  useEffect(() => {
    if (toolArgs?.success) {
      try {
        const selection = stringToSelection(toolArgs.data.code_cell_position, sheets.current, sheets.a1Context);
        const { x, y } = selection.getCursor();
        setCodeCellPos({ x, y });
      } catch (error) {
        console.error('[SetCodeCellValue] Failed to parse position: ', error);
      }
    }
  }, [toolArgs]);

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
    () => async (toolArgs: SetCodeCellValueResponse) => {
      if (!codeCellPos) {
        return;
      }

      // First try using provided cell_name, then fall back to language-based name
      const cellName = toolArgs.cell_name ? toolArgs.cell_name : `${toolArgs.code_cell_language}Code`;

      // Use the helper function to set code cell value and name in one transaction
      await setCodeCellValueAndName(
        sheets.current,
        codeCellPos.x,
        codeCellPos.y,
        toolArgs.code_string,
        toolArgs.code_cell_language,
        cellName,
        sheets.getCursorPosition()
      );
    },
    [codeCellPos]
  );

  const estimatedNumberOfLines = useMemo(() => {
    if (toolArgs?.success) {
      return toolArgs.data.code_string.split('\n').length;
    } else {
      return args.split('\\n').length;
    }
  }, [toolArgs, args]);

  // Loading state - similar to AddDataTable component
  if (loading) {
    const icon = <LanguageIcon language="" className="text-primary" />;
    const label = 'Code';
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  // Error state
  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={<LanguageIcon language="" />} label="Code" hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard isLoading />;
  }

  // Success state - extract data from toolArgs
  const { code_cell_language, code_cell_position, cell_name } = toolArgs.data;
  const icon = <LanguageIcon language={code_cell_language} />;

  return (
    <ToolCard
      icon={icon}
      label={
        <span>
          {code_cell_language} {cell_name && <span className="text-muted-foreground">| {cell_name}</span>}
        </span>
      }
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
