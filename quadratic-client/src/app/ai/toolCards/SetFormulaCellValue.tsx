import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { sheets } from '@/app/grid/controller/Sheets';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useState } from 'react';
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

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        const parsed = aiToolsSpec[AITool.SetFormulaCellValue].responseSchema.safeParse(json);
        setToolArgs(parsed);
      } catch (error) {
        setToolArgs(undefined);
        console.error('[SetFormulaCellValue] Failed to parse args: ', error);
      }
    }, [args, loading]);

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

    const { code_cell_position } = toolArgs.data;
    return (
      <ToolCard
        icon={<LanguageIcon language="Formula" />}
        label={label}
        description={code_cell_position}
        className={className}
        compact
        onClick={handleClick}
        hideIcon={hideIcon}
      />
    );
  }
);
