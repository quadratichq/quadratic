import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { TableIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type ConvertToTableResponse = z.infer<(typeof aiToolsSpec)[AITool.ConvertToTable]['responseSchema']>;

export const ConvertToTable = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<ConvertToTableResponse, ConvertToTableResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.ConvertToTable].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[ConvertToTable] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <TableIcon />;
    const label = 'Convert to Table';

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError className={className} />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    return (
      <ToolCard
        icon={icon}
        label={
          <span>
            {label} <span className="text-muted-foreground">| {toolArgs.data.table_name}</span>
          </span>
        }
        description={toolArgs.data.selection}
        className={className}
      />
    );
  }
);
