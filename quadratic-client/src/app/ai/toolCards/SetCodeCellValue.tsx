import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { sheets } from '@/app/grid/controller/Sheets';
import { parseFullJson, parsePartialJson } from '@/app/shared/utils/SafeJsonParsing';
import { aiUser } from '@/app/web-workers/multiplayerWebWorker/aiUser';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type SetCodeCellValueResponse = AIToolsArgs[AITool.SetCodeCellValue];

export const SetCodeCellValue = memo(
  ({
    toolCall: { arguments: args, loading },
    className,
    isUpdate,
    hideIcon,
  }: {
    toolCall: AIToolCall;
    className: string;
    isUpdate?: boolean;
    hideIcon?: boolean;
  }) => {
    const [toolArgs, setToolArgs] =
      useState<z.SafeParseReturnType<SetCodeCellValueResponse, SetCodeCellValueResponse>>();

    useEffect(() => {
      // Try to parse position even while loading to move cursor early
      if (loading) {
        const partialJson = parsePartialJson<SetCodeCellValueResponse>(args);
        if (partialJson && 'code_cell_position' in partialJson && partialJson.code_cell_position) {
          try {
            const sheetId = partialJson.sheet_name
              ? (sheets.getSheetByName(partialJson.sheet_name)?.id ?? sheets.current)
              : sheets.current;
            const selection = sheets.stringToSelection(partialJson.code_cell_position, sheetId);

            // Move AI cursor to the code cell position as soon as we know the location
            try {
              const selectionString = selection.save();
              aiUser.updateSelection(selectionString, sheetId);
            } catch (e) {
              console.warn('[SetCodeCellValue] Failed to update AI cursor while loading:', e);
            }

            selection.free();
          } catch (e) {
            console.warn('[SetCodeCellValue] Failed to parse position while loading:', e);
          }
        }
        setToolArgs(undefined);
        return;
      }

      const fullJson = parseFullJson<SetCodeCellValueResponse>(args);
      if (!fullJson) {
        setToolArgs(undefined);
        return;
      }

      const parsed = AIToolsArgsSchema[AITool.SetCodeCellValue].safeParse(fullJson);
      setToolArgs(parsed);
    }, [args, loading]);

    const estimatedNumberOfLines = useMemo(() => {
      if (toolArgs?.data) {
        return toolArgs.data.code_string.split('\n').length;
      } else {
        return args.split('\\n').length;
      }
    }, [toolArgs, args]);

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

    if (loading && estimatedNumberOfLines) {
      const partialJson = parsePartialJson<SetCodeCellValueResponse>(args);
      if (partialJson && 'code_cell_language' in partialJson) {
        const { code_cell_language: language, code_cell_position: position } = partialJson;
        return (
          <ToolCard
            icon={<LanguageIcon language={language ?? ''} />}
            label={isUpdate ? 'Updating code' : 'Writing code'}
            description={
              `${estimatedNumberOfLines} line` +
              (estimatedNumberOfLines === 1 ? '' : 's') +
              (position ? ` at ${position}` : '')
            }
            isLoading={true}
            className={className}
            compact
            hideIcon={hideIcon}
          />
        );
      }
    }

    if (!!toolArgs && !toolArgs.success) {
      return (
        <ToolCard
          icon={<LanguageIcon language="" />}
          label={isUpdate ? 'Updated code' : 'Wrote code'}
          hasError
          className={className}
          compact
          hideIcon={hideIcon}
        />
      );
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard isLoading className={className} compact hideIcon={hideIcon} />;
    }

    const { code_cell_name, code_cell_language, code_cell_position } = toolArgs.data;
    return (
      <ToolCard
        icon={<LanguageIcon language={code_cell_language} />}
        label={`${isUpdate ? 'Updated' : 'Wrote'} code ${code_cell_name || code_cell_language}`}
        description={
          `${estimatedNumberOfLines} line` + (estimatedNumberOfLines === 1 ? '' : 's') + ` at ${code_cell_position}`
        }
        className={className}
        compact
        onClick={handleClick}
        hideIcon={hideIcon}
      />
    );
  }
);
