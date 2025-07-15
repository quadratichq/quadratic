import { ToolCardQuery } from '@/app/ai/toolCards/ToolCardQuery';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type GetDatabaseSchemasResponse = z.infer<(typeof aiToolsSpec)[AITool.GetDatabaseSchemas]['responseSchema']>;

type GetDatabaseSchemasProps = {
  args: string;
  loading: boolean;
};

export const GetDatabaseSchemas = memo(({ args, loading }: GetDatabaseSchemasProps) => {
  const [toolArgs, setToolArgs] =
    useState<z.SafeParseReturnType<GetDatabaseSchemasResponse, GetDatabaseSchemasResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.GetDatabaseSchemas].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[GetDatabaseSchemas] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  let label = 'Retrieving database schemas';
  if (toolArgs?.data?.connection_ids && toolArgs.data.connection_ids.length > 0) {
    const connectionCount = toolArgs.data.connection_ids.length;
    label = `Retrieving schemas for ${connectionCount} database connection${connectionCount === 1 ? '' : 's'}`;
  } else {
    label = 'Retrieving schemas for all team database connections';
  }
  label += '...';

  if (loading) {
    return <ToolCardQuery label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCardQuery label={label} hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCardQuery label={label} isLoading />;
  }

  // When completed successfully
  const completedLabel =
    toolArgs.data.connection_ids && toolArgs.data.connection_ids.length > 0
      ? `Retrieved schemas for ${toolArgs.data.connection_ids.length} database connection${toolArgs.data.connection_ids.length === 1 ? '' : 's'}.`
      : 'Retrieved schemas for all team database connections.';

  return <ToolCardQuery label={completedLabel} />;
});
