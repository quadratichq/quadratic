import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type InsertColumnsResponse = z.infer<(typeof aiToolsSpec)[AITool.InsertColumns]['responseSchema']>;

export const InsertColumns = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<InsertColumnsResponse, InsertColumnsResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = args ? JSON.parse(args) : {};
        setToolArgs(aiToolsSpec[AITool.InsertColumns].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[InsertColumns] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <GridActionIcon />;
    const label = 'Insert columns';

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError description={toolArgs.error.message} className={className} />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    const description = `${toolArgs.data.count > 1 ? `${toolArgs.data.count} columns have` : 'A column has'} been inserted in sheet "${toolArgs.data.sheet_name}" at column "${toolArgs.data.column}".`;

    return <ToolCard icon={icon} label={label} description={description} className={className} />;
  }
);
