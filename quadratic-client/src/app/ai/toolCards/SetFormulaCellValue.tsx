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
  ({
    toolCall: { arguments: args, loading },
    className,
    hideIcon,
  }: {
    toolCall: AIToolCall;
    className: string;
    hideIcon?: boolean;
  }) => {
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

        // Set code cell position to the first formula's position (for single formula actions)
        if (parsed.success && parsed.data.formulas.length > 0) {
          try {
            const sheetId = parsed.data.sheet_name
              ? (sheets.getSheetByName(parsed.data.sheet_name)?.id ?? sheets.current)
              : sheets.current;
            const selection = sheets.stringToSelection(parsed.data.formulas[0].code_cell_position, sheetId);
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
        (formulaString: string) => {
          if (!codeCellPos) {
            return;
          }

          set(codeEditorAtom, (prev) => ({
            ...prev,
            diffEditorContent: { editorContent: formulaString, isApplied: false },
            waitingForEditorClose: {
              codeCell: {
                sheetId: toolArgs?.data?.sheet_name
                  ? (sheets.getSheetByName(toolArgs.data.sheet_name)?.id ?? sheets.current)
                  : sheets.current,
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
      () => (formulaString: string) => {
        if (!codeCellPos) {
          return;
        }

        quadraticCore.setCodeCellValue({
          sheetId: toolArgs?.data?.sheet_name
            ? (sheets.getSheetByName(toolArgs.data.sheet_name)?.id ?? sheets.current)
            : sheets.current,
          x: codeCellPos.x,
          y: codeCellPos.y,
          codeString: formulaString,
          language: 'Formula',
          isAi: false,
        });
      },
      [codeCellPos]
    );

    const formulaCount = toolArgs?.success ? toolArgs.data.formulas.length : 0;
    const label = loading
      ? formulaCount > 1
        ? 'Writing formulas'
        : 'Writing formula'
      : formulaCount > 1
        ? 'Wrote formulas'
        : 'Wrote formula';

    const handleClick = useCallback(() => {
      if (!toolArgs?.success || !toolArgs.data?.formulas.length) return;
      try {
        const sheetId = toolArgs.data.sheet_name
          ? (sheets.getSheetByName(toolArgs.data.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        // Select the first formula's position
        const selection = sheets.stringToSelection(toolArgs.data.formulas[0].code_cell_position, sheetId);
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
          hideIcon={hideIcon}
        />
      );
    }

    if (!!toolArgs && !toolArgs.success) {
      return (
        <ToolCard
          icon={<LanguageIcon language="Formula" />}
          label={label}
          hasError
          className={className}
          compact
          hideIcon={hideIcon}
        />
      );
    } else if (!toolArgs || !toolArgs.data) {
      return (
        <ToolCard
          icon={<LanguageIcon language="Formula" />}
          label={label}
          isLoading
          className={className}
          compact
          hideIcon={hideIcon}
        />
      );
    }

    const { formulas } = toolArgs.data;
    const positions = formulas.map((f) => f.code_cell_position).join(', ');
    const isSingleFormula = formulas.length === 1;

    return (
      <ToolCard
        icon={<LanguageIcon language="Formula" />}
        label={label}
        description={positions}
        actions={
          codeCellPos && isSingleFormula ? (
            <div className="flex gap-1">
              <TooltipPopover label={'Open diff in editor'}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openDiffInEditor(formulas[0].formula_string);
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
                    saveAndRun(formulas[0].formula_string);
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
        hideIcon={hideIcon}
      />
    );
  }
);
