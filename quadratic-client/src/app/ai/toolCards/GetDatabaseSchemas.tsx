import { ToolCardQuery } from '@/app/ai/toolCards/ToolCardQuery';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type GetDatabaseSchemasResponse = AIToolsArgs[AITool.GetDatabaseSchemas];

export const GetDatabaseSchemas = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] =
      useState<z.SafeParseReturnType<GetDatabaseSchemasResponse, GetDatabaseSchemasResponse>>();

    useEffect(() => {
      if (!loading) {
        try {
          const json = JSON.parse(args);
          setToolArgs(AIToolsArgsSchema[AITool.GetDatabaseSchemas].safeParse(json));
        } catch (error) {
          setToolArgs(undefined);
          console.error('[GetDatabaseSchemas] Failed to parse args: ', error);
        }
      } else {
        setToolArgs(undefined);
      }
    }, [args, loading]);

    const label = useMemo(() => {
      let label = 'Retrieving database schemas';
      if (toolArgs?.data?.connection_ids && toolArgs.data.connection_ids.length > 0) {
        const connectionCount = toolArgs.data.connection_ids.length;
        label = `Retrieving schemas for ${connectionCount} database connection${connectionCount === 1 ? '' : 's'}`;
      } else {
        label = 'Retrieving schemas for all team database connections';
      }
      label += '...';
      return label;
    }, [toolArgs?.data?.connection_ids]);

    if (loading) {
      return <ToolCardQuery label={label} isLoading className={className} />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCardQuery label={label} hasError className={className} />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCardQuery label={label} isLoading className={className} />;
    }

    // When completed successfully
    const completedLabel =
      toolArgs.data.connection_ids && toolArgs.data.connection_ids.length > 0
        ? `Retrieved schemas for ${toolArgs.data.connection_ids.length} database connection${toolArgs.data.connection_ids.length === 1 ? '' : 's'}.`
        : 'Retrieved schemas for all team database connections.';

    return <ToolCardQuery label={completedLabel} className={className} />;
  }
);
