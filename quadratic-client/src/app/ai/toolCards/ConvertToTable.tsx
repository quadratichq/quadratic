import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { TableIcon } from '@/shared/components/Icons';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type ConvertToTableResponse = AIToolsArgs[AITool.ConvertToTable];

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
        setToolArgs(AIToolsArgsSchema[AITool.ConvertToTable].safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[ConvertToTable] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <TableIcon />;
    const baseLabel = loading ? 'Converting to table' : 'Converted to table';

    if (loading) {
      return <ToolCard icon={icon} label={baseLabel} isLoading className={className} compact />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={baseLabel} hasError className={className} compact />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={baseLabel} isLoading className={className} compact />;
    }

    return (
      <ToolCard
        icon={icon}
        label={`${baseLabel} ${toolArgs.data.table_name}`}
        description={toolArgs.data.selection}
        className={className}
        compact
      />
    );
  }
);
