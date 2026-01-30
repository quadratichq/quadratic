import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { CodeIcon, SaveAndRunIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useState } from 'react';
import { useRecoilCallback } from 'recoil';
import type { z } from 'zod';

type SetFormulaCellValueResponse = AIToolsArgs[AITool.SetFormulaCellValue];

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
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        const parsed = AIToolsArgsSchema[AITool.SetFormulaCellValue].safeParse(json);
        setToolArgs(parsed);

        // Set code cell position to the first formula's position (for single formula actions)
        if (parsed.success && parsed.data.formulas.length > 0) {
          try {
            const firstFormula = parsed.data.formulas[0];
            const sheetId = firstFormula.sheet_name
              ? (sheets.getSheetByName(firstFormula.sheet_name)?.id ?? sheets.current)
              : sheets.current;
            const selection = sheets.stringToSelection(firstFormula.code_cell_position, sheetId);
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
        (formula: { sheet_name?: string | null; code_cell_position: string; formula_string: string }) => {
          let pos: JsCoordinate | undefined;
          let sheetId: string;
          try {
            sheetId = formula.sheet_name
              ? (sheets.getSheetByName(formula.sheet_name)?.id ?? sheets.current)
              : sheets.current;
            const selection = sheets.stringToSelection(formula.code_cell_position, sheetId);
            const cursor = selection.getCursor();
            pos = { x: cursor.x, y: cursor.y };
            selection.free();
          } catch (e) {
            console.warn('[SetFormulaCellValue] Failed to get position for diff editor:', e);
            return;
          }

          if (!pos) return;

          set(codeEditorAtom, (prev) => ({
            ...prev,
            diffEditorContent: { editorContent: formula.formula_string, isApplied: false },
            waitingForEditorClose: {
              codeCell: {
                sheetId,
                pos,
                language: 'Formula' as const,
                lastModified: 0,
                isSingleCell: true,
              },
              showCellTypeMenu: false,
              inlineEditor: false,
              initialCode: '',
            },
          }));
        },
      []
    );

    const saveAndRun = useRecoilCallback(
      () => (formula: { sheet_name?: string | null; code_cell_position: string; formula_string: string }) => {
        let pos: JsCoordinate | undefined;
        let sheetId: string;
        try {
          sheetId = formula.sheet_name
            ? (sheets.getSheetByName(formula.sheet_name)?.id ?? sheets.current)
            : sheets.current;
          const selection = sheets.stringToSelection(formula.code_cell_position, sheetId);
          const cursor = selection.getCursor();
          pos = { x: cursor.x, y: cursor.y };
          selection.free();
        } catch (e) {
          console.warn('[SetFormulaCellValue] Failed to get position for save and run:', e);
          return;
        }

        if (!pos) return;

        quadraticCore.setCodeCellValue({
          sheetId,
          x: pos.x,
          y: pos.y,
          codeString: formula.formula_string,
          language: 'Formula',
          isAi: false,
        });
      },
      []
    );

    const handleFormulaClick = useCallback((formula: { sheet_name?: string | null; code_cell_position: string }) => {
      try {
        const sheetId = formula.sheet_name
          ? (sheets.getSheetByName(formula.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        const selection = sheets.stringToSelection(formula.code_cell_position, sheetId);
        sheets.changeSelection(selection);
      } catch (e) {
        console.warn('Failed to select range:', e);
      }
    }, []);

    const formulaCount = toolArgs?.success ? toolArgs.data.formulas.length : 0;
    const label = loading
      ? formulaCount > 1
        ? 'Writing formulas'
        : 'Writing formula'
      : formulaCount > 1
        ? `Wrote ${formulaCount} formulas`
        : 'Wrote formula';

    const handleClick = useCallback(() => {
      if (!toolArgs?.success || !toolArgs.data?.formulas.length) return;
      try {
        const firstFormula = toolArgs.data.formulas[0];
        const sheetId = firstFormula.sheet_name
          ? (sheets.getSheetByName(firstFormula.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        // Select the first formula's position
        const selection = sheets.stringToSelection(firstFormula.code_cell_position, sheetId);
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
    const isSingleFormula = formulas.length === 1;

    // Single formula: show inline with actions
    if (isSingleFormula) {
      const formula = formulas[0];
      return (
        <ToolCard
          icon={<LanguageIcon language="Formula" />}
          label={label}
          description={`${formula.code_cell_position}: ${formula.formula_string}`}
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
                      openDiffInEditor(formula);
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
                      saveAndRun(formula);
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

    // Multiple formulas: show collapsed view with expand/collapse
    return (
      <div className={cn('flex flex-col', className)}>
        <div
          className="flex cursor-pointer select-none items-center gap-1.5 text-sm text-muted-foreground hover:text-muted-foreground/80"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {!hideIcon && <LanguageIcon language="Formula" />}
          <span>{label}</span>
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {isExpanded && (
          <div className="ml-[7px] mt-1 flex flex-col gap-1 border-l-2 border-muted-foreground/20 pl-3">
            {formulas.map((formula) => (
              <div
                key={`${formula.sheet_name ?? 'default'}-${formula.code_cell_position}`}
                className="flex cursor-pointer select-none items-center gap-1.5 text-sm text-muted-foreground hover:text-muted-foreground/80"
                onClick={() => handleFormulaClick(formula)}
              >
                <span className="font-medium">{formula.code_cell_position}:</span>
                <span className="min-w-0 truncate font-mono text-xs">{formula.formula_string}</span>
                <div className="ml-auto flex shrink-0 gap-1">
                  <TooltipPopover label={'Open diff in editor'}>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openDiffInEditor(formula);
                      }}
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
                        saveAndRun(formula);
                      }}
                    >
                      <SaveAndRunIcon />
                    </Button>
                  </TooltipPopover>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);
