import { getRowColSentence, ToolCard } from '@/app/ai/toolCards/ToolCard';
import { TableRowsIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type SetCellValuesResponse = z.infer<(typeof aiToolsSpec)[AITool.SetCellValues]['responseSchema']>;

export const SetCellValues = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<SetCellValuesResponse, SetCellValuesResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.SetCellValues].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[SetCellValues] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <TableRowsIcon />;
    const label = loading ? 'Inserting data' : 'Inserted data';

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
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
      />
    );
  }
);
