import { getRowColSentence, ToolCard } from '@/app/ai/toolCards/ToolCard';
import { sheets } from '@/app/grid/controller/Sheets';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { TableIcon } from '@/shared/components/Icons';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useState } from 'react';
import type { z } from 'zod';

type AddDataTableResponse = AIToolsArgs[AITool.AddDataTable];

interface CompressedAddDataTable {
  _compressed: string;
  sheet_name?: string;
  top_left_position?: string;
  table_name?: string;
  compressed_rows?: number;
  compressed_cols?: number;
}

export const AddDataTable = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<AddDataTableResponse, AddDataTableResponse>>();
    const [compressedArgs, setCompressedArgs] = useState<CompressedAddDataTable>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        setCompressedArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);

        if ('_compressed' in json) {
          setCompressedArgs(json as CompressedAddDataTable);
          setToolArgs(undefined);
          return;
        }

        setToolArgs(AIToolsArgsSchema[AITool.AddDataTable].safeParse(json));
        setCompressedArgs(undefined);
      } catch (error) {
        setToolArgs(undefined);
        setCompressedArgs(undefined);
        console.error('[AddDataTable] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <TableIcon />;
    const label = loading ? 'Inserting table' : 'Inserted table';

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
    }, [toolArgs, compressedArgs]);

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    if (compressedArgs) {
      const { top_left_position, table_name, compressed_rows: rows, compressed_cols: cols } = compressedArgs;
      const parts: string[] = [];
      if (table_name) parts.push(table_name);
      if (rows != null && cols != null) parts.push(getRowColSentence({ rows, cols }));
      if (top_left_position) parts.push(`at ${top_left_position}`);
      return (
        <ToolCard
          icon={icon}
          label={label}
          description={parts.length > 0 ? parts.join(' · ') : undefined}
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
