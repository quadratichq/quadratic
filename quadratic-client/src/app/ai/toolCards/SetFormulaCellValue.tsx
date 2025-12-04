import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { CodeIcon, SaveAndRunIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useState } from 'react';
import { useRecoilCallback } from 'recoil';
import type { z } from 'zod';

type SetFormulaCellValueResponse = z.infer<(typeof aiToolsSpec)[AITool.SetFormulaCellValue]['responseSchema']>;

export const SetFormulaCellValue = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] =
      useState<z.SafeParseReturnType<SetFormulaCellValueResponse, SetFormulaCellValueResponse>>();
    const [codeCellPos, setCodeCellPos] = useState<JsCoordinate | undefined>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        const parsed = aiToolsSpec[AITool.SetFormulaCellValue].responseSchema.safeParse(json);
        setToolArgs(parsed);

        if (parsed.success) {
          try {
            const sheetId = parsed.data.sheet_name
              ? (sheets.getSheetByName(parsed.data.sheet_name)?.id ?? sheets.current)
              : sheets.current;
            const selection = sheets.stringToSelection(parsed.data.code_cell_position, sheetId);
            const { x, y } = selection.getCursor();
            setCodeCellPos({ x, y });
            selection.free();
          } catch (e) {
            console.warn('[SetFormulaCellValue] Failed to set code cell position: ', e);
            setCodeCellPos(undefined);
          }
        }
      } catch (error) {
        setToolArgs(undefined);
        console.error('[SetFormulaCellValue] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const openDiffInEditor = useRecoilCallback(
      ({ set }) =>
        (toolArgs: SetFormulaCellValueResponse) => {
          if (!codeCellPos) {
            return;
          }

          set(codeEditorAtom, (prev) => ({
            ...prev,
            diffEditorContent: { editorContent: toolArgs.formula_string, isApplied: false },
            waitingForEditorClose: {
              codeCell: {
                sheetId: sheets.current,
                pos: codeCellPos,
                language: 'Formula' as const,
                lastModified: 0,
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
      () => (toolArgs: SetFormulaCellValueResponse) => {
        if (!codeCellPos) {
          return;
        }

        quadraticCore.setCodeCellValue({
          sheetId: sheets.current,
          x: codeCellPos.x,
          y: codeCellPos.y,
          codeString: toolArgs.formula_string,
          language: 'Formula',
          isAi: false,
        });
      },
      [codeCellPos]
    );

    const label = loading ? 'Writing formula' : 'Wrote formula';

    const handleClick = useCallback(() => {
      if (!toolArgs?.success || !toolArgs.data?.code_cell_position) return;
      try {
        const sheetId = toolArgs.data.sheet_name
          ? (sheets.getSheetByName(toolArgs.data.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        const selection = sheets.stringToSelection(toolArgs.data.code_cell_position, sheetId);
        sheets.changeSelection(selection);
      } catch (e) {
        console.warn('Failed to select range:', e);
      }
    }, [toolArgs]);

    if (loading) {
      return (
        <ToolCard
          icon={<LanguageIcon language="Formula" />}
          label={label}
          isLoading={true}
          className={className}
          compact
        />
      );
    }

    if (!!toolArgs && !toolArgs.success) {
      return (
        <ToolCard icon={<LanguageIcon language="Formula" />} label={label} hasError className={className} compact />
      );
    } else if (!toolArgs || !toolArgs.data) {
      return (
        <ToolCard icon={<LanguageIcon language="Formula" />} label={label} isLoading className={className} compact />
      );
    }

    const { code_cell_position } = toolArgs.data;
    return (
      <ToolCard
        icon={<LanguageIcon language="Formula" />}
        label={label}
        description={code_cell_position}
        actions={
          codeCellPos ? (
            <div className="flex gap-1">
              <TooltipPopover label={'Open diff in editor'}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openDiffInEditor(toolArgs.data);
                  }}
                  disabled={!codeCellPos}
                >
                  <CodeIcon />
                </Button>
              </TooltipPopover>

              <TooltipPopover label={'Apply'}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    saveAndRun(toolArgs.data);
                  }}
                  disabled={!codeCellPos}
                >
                  <SaveAndRunIcon />
                </Button>
              </TooltipPopover>
            </div>
          ) : undefined
        }
        className={className}
        compact
        onClick={handleClick}
      />
    );
  }
);
