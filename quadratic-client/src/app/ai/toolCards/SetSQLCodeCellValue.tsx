import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { sheets } from '@/app/grid/controller/Sheets';
import { parseFullJson, parsePartialJson } from '@/app/shared/utils/SafeJsonParsing';
import { aiUser } from '@/app/web-workers/multiplayerWebWorker/aiUser';
import { ConnectionIcon } from '@/shared/components/ConnectionIcon';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type SetSQLCodeCellValueResponse = AIToolsArgs[AITool.SetSQLCodeCellValue];

interface CompressedSetSQLCodeCellValue {
  _compressed: string;
  sheet_name?: string;
  code_cell_name?: string;
  connection_kind?: string;
  code_cell_position?: string;
  compressed_line_count?: number;
}

export const SetSQLCodeCellValue = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] =
      useState<z.SafeParseReturnType<SetSQLCodeCellValueResponse, SetSQLCodeCellValueResponse>>();
    const [compressedArgs, setCompressedArgs] = useState<CompressedSetSQLCodeCellValue>();

    useEffect(() => {
      // Try to parse position even while loading to move cursor early
      if (loading) {
        const partialJson = parsePartialJson<SetSQLCodeCellValueResponse>(args);
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
              console.warn('[SetSQLCodeCellValue] Failed to update AI cursor while loading:', e);
            }

            selection.free();
          } catch (e) {
            console.warn('[SetSQLCodeCellValue] Failed to parse position while loading:', e);
          }
        }
        setToolArgs(undefined);
        setCompressedArgs(undefined);
        return;
      }

      const fullJson = parseFullJson<SetSQLCodeCellValueResponse>(args);
      if (!fullJson) {
        setToolArgs(undefined);
        setCompressedArgs(undefined);
        return;
      }

      if ('_compressed' in fullJson) {
        setCompressedArgs(fullJson as unknown as CompressedSetSQLCodeCellValue);
        setToolArgs(undefined);
        return;
      }

      const parsed = AIToolsArgsSchema[AITool.SetSQLCodeCellValue].safeParse(fullJson);
      setToolArgs(parsed);
      setCompressedArgs(undefined);
    }, [args, loading]);

    const estimatedNumberOfLines = useMemo(() => {
      if (compressedArgs?.compressed_line_count) {
        return compressedArgs.compressed_line_count;
      }
      if (toolArgs?.data) {
        return toolArgs.data.sql_code_string.split('\n').length;
      } else {
        return args.split('\\n').length;
      }
    }, [toolArgs, compressedArgs, args]);

    const handleClick = useCallback(() => {
      const position = compressedArgs?.code_cell_position ?? toolArgs?.data?.code_cell_position;
      const sheetName = compressedArgs?.sheet_name ?? toolArgs?.data?.sheet_name;
      if (!position) return;
      try {
        const sheetId = sheetName ? (sheets.getSheetByName(sheetName)?.id ?? sheets.current) : sheets.current;
        const selection = sheets.stringToSelection(position, sheetId);
        sheets.changeSelection(selection);
      } catch (e) {
        console.warn('Failed to select range:', e);
      }
    }, [toolArgs, compressedArgs]);

    if (loading && estimatedNumberOfLines) {
      const partialJson = parsePartialJson<SetSQLCodeCellValueResponse>(args);
      if (partialJson && 'connection_kind' in partialJson) {
        const { connection_kind, code_cell_position: position } = partialJson;
        return (
          <ToolCard
            icon={<ConnectionIcon type={connection_kind ?? ''} />}
            label={connection_kind}
            description={
              `${estimatedNumberOfLines} line` +
              (estimatedNumberOfLines === 1 ? '' : 's') +
              (position ? ` at ${position}` : '')
            }
            isLoading={true}
            className={className}
            compact
          />
        );
      }
    }

    if (compressedArgs) {
      const { code_cell_name, connection_kind, code_cell_position } = compressedArgs;
      return (
        <ToolCard
          icon={<ConnectionIcon type={connection_kind ?? ''} />}
          label={code_cell_name || connection_kind || 'SQL'}
          description={
            `${estimatedNumberOfLines} line` +
            (estimatedNumberOfLines === 1 ? '' : 's') +
            (code_cell_position ? ` at ${code_cell_position}` : '')
          }
          className={className}
          compact
          onClick={handleClick}
        />
      );
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={<ConnectionIcon type="" />} label="Code" hasError className={className} compact />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard isLoading className={className} compact />;
    }

    const { code_cell_name, connection_kind, code_cell_position } = toolArgs.data;
    return (
      <ToolCard
        icon={<ConnectionIcon type={connection_kind} />}
        label={code_cell_name || connection_kind}
        description={
          `${estimatedNumberOfLines} line` + (estimatedNumberOfLines === 1 ? '' : 's') + ` at ${code_cell_position}`
        }
        className={className}
        compact
        onClick={handleClick}
      />
    );
  }
);
