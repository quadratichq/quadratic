import { getRowColSentence, ToolCard } from '@/app/ai/toolCards/ToolCard';
import { TableIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type AddDataTableResponse = z.infer<(typeof aiToolsSpec)[AITool.AddDataTable]['responseSchema']>;

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
        setToolArgs(aiToolsSpec[AITool.AddDataTable].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[AddDataTable] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <TableIcon />;
    const label = loading ? 'Inserting table' : 'Inserted table';

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
        description={`${table_name} • ${getRowColSentence({ rows, cols })} at ${top_left_position}`}
        className={className}
        compact
      />
    );
  }
);
