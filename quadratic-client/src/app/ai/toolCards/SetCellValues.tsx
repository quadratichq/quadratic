import { getRowColSentence, ToolCard } from '@/app/ai/toolCards/ToolCard';
import { sheets } from '@/app/grid/controller/Sheets';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { TableRowsIcon } from '@/shared/components/Icons';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useState } from 'react';
import type { z } from 'zod';

type SetCellValuesResponse = AIToolsArgs[AITool.SetCellValues];

interface CompressedSetCellValues {
  _compressed: string;
  sheet_name?: string;
  top_left_position?: string;
  compressed_rows?: number;
  compressed_cols?: number;
}

export const SetCellValues = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<SetCellValuesResponse, SetCellValuesResponse>>();
    const [compressedArgs, setCompressedArgs] = useState<CompressedSetCellValues>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        setCompressedArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);

        if ('_compressed' in json) {
          setCompressedArgs(json as CompressedSetCellValues);
          setToolArgs(undefined);
          return;
        }

        setToolArgs(AIToolsArgsSchema[AITool.SetCellValues].safeParse(json));
        setCompressedArgs(undefined);
      } catch (error) {
        setToolArgs(undefined);
        setCompressedArgs(undefined);
        console.error('[SetCellValues] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <TableRowsIcon />;
    const label = loading ? 'Inserting data' : 'Inserted data';

    const handleClick = useCallback(() => {
      if (compressedArgs?.top_left_position) {
        try {
          const sheetId = compressedArgs.sheet_name
            ? (sheets.getSheetByName(compressedArgs.sheet_name)?.id ?? sheets.current)
            : sheets.current;
          const selection = sheets.stringToSelection(compressedArgs.top_left_position, sheetId);
          sheets.changeSelection(selection);
        } catch (e) {
          console.warn('Failed to select range:', e);
        }
        return;
      }

      if (!toolArgs?.success || !toolArgs.data) return;
      const { top_left_position, cell_values, sheet_name } = toolArgs.data;
      const rows = cell_values.length;
      const cols = cell_values.reduce((max, row) => Math.max(max, row.length), 0);
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
    }, [toolArgs, compressedArgs]);

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    if (compressedArgs) {
      const { top_left_position, compressed_rows: rows, compressed_cols: cols } = compressedArgs;
      return (
        <ToolCard
          icon={icon}
          label={label}
          description={
            rows != null && cols != null && top_left_position
              ? `${getRowColSentence({ rows, cols })} at ${top_left_position}`
              : top_left_position
                ? `at ${top_left_position}`
                : undefined
          }
          className={className}
          compact
          onClick={handleClick}
        />
      );
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError className={className} compact />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    const { top_left_position, cell_values } = toolArgs.data;
    const rows = cell_values.length;
    const cols = cell_values.reduce((max, row) => Math.max(max, row.length), 0);

    return (
      <ToolCard
        icon={icon}
        label={label}
        description={`${getRowColSentence({ rows, cols })} at ${top_left_position}`}
        className={className}
        compact
        onClick={handleClick}
      />
    );
  }
);
