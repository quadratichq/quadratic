import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { sheets } from '@/app/grid/controller/Sheets';
import { FormatPaintIcon } from '@/shared/components/Icons';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type SetBordersResponse = AIToolsArgs[AITool.SetBorders];

export const SetBorders = memo(
  ({
    toolCall: { arguments: args, loading },
    className,
    hideIcon,
  }: {
    toolCall: AIToolCall;
    className: string;
    hideIcon?: boolean;
  }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<SetBordersResponse, SetBordersResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = args ? JSON.parse(args) : {};
        setToolArgs(AIToolsArgsSchema[AITool.SetBorders].safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[SetBorders] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <FormatPaintIcon />;
    const label = loading ? 'Formatting borders' : 'Formatted borders';

    const description = useMemo(() => {
      if (toolArgs?.success) {
        const range = `${toolArgs.data.sheet_name ? `"${toolArgs.data.sheet_name}"!` : ''}${toolArgs.data.selection}`;
        const color = toolArgs.data.color;
        const details = `${toolArgs.data.line} ${toolArgs.data.border_selection}`;
        return (
          <span className="inline-flex items-center gap-1">
            {range}
            <span className="inline-block h-3 w-3 rounded-sm border border-border" style={{ backgroundColor: color }} />
            {details}
          </span>
        );
      }
      return '';
    }, [
      toolArgs?.data?.border_selection,
      toolArgs?.data?.color,
      toolArgs?.data?.line,
      toolArgs?.data?.selection,
      toolArgs?.data?.sheet_name,
      toolArgs?.success,
    ]);

    const handleClick = useCallback(() => {
      if (!toolArgs?.success || !toolArgs.data?.selection) return;
      try {
        const sheetId = toolArgs.data.sheet_name
          ? (sheets.getSheetByName(toolArgs.data.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        const selection = sheets.stringToSelection(toolArgs.data.selection, sheetId);
        sheets.changeSelection(selection);
      } catch (e) {
        console.warn('Failed to select range:', e);
      }
    }, [toolArgs]);

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact hideIcon={hideIcon} />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return (
        <ToolCard
          icon={icon}
          label={label}
          hasError
          description={toolArgs.error.message}
          className={className}
          compact
          hideIcon={hideIcon}
        />
      );
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact hideIcon={hideIcon} />;
    }

    return (
      <ToolCard
        icon={icon}
        label={label}
        description={description}
        className={className}
        compact
        onClick={handleClick}
        hideIcon={hideIcon}
      />
    );
  }
);
