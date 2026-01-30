import { getRowColSentence, ToolCard } from '@/app/ai/toolCards/ToolCard';
import { sheets } from '@/app/grid/controller/Sheets';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { TableIcon } from '@/shared/components/Icons';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useState } from 'react';
import type { z } from 'zod';

type AddDataTableResponse = AIToolsArgs[AITool.AddDataTable];

export const AddDataTable = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<AddDataTableResponse, AddDataTableResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(AIToolsArgsSchema[AITool.AddDataTable].safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[AddDataTable] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <TableIcon />;
    const label = loading ? 'Inserting table' : 'Inserted table';

    const handleClick = useCallback(() => {
      if (!toolArgs?.success || !toolArgs.data) return;
      const { top_left_position, table_data, sheet_name } = toolArgs.data;
      const rows = table_data.length;
      const cols = table_data.reduce((max, row) => Math.max(max, row.length), 0);
      try {
        const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
        const startSelection = sheets.stringToSelection(top_left_position, sheetId);
        const { x, y } = startSelection.getCursor();
        startSelection.free();
        const endX = x + cols - 1;
        const endY = y + rows - 1;
        const rangeString = `${xyToA1(x, y)}:${xyToA1(endX, endY)}`;
        const selection = sheets.stringToSelection(rangeString, sheetId);
        sheets.changeSelection(selection);
      } catch (e) {
        console.warn('Failed to select range:', e);
      }
    }, [toolArgs]);

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError className={className} compact />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    const { top_left_position, table_name, table_data } = toolArgs.data;
    const rows = table_data.length;
    const cols = table_data.reduce((max, row) => Math.max(max, row.length), 0);

    return (
      <ToolCard
        icon={icon}
        label={label}
        description={`${table_name} · ${getRowColSentence({ rows, cols })} at ${top_left_position}`}
        className={className}
        compact
        onClick={handleClick}
      />
    );
  }
);
