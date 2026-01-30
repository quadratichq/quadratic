import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type RerunCodeResponse = AIToolsArgs[AITool.RerunCode];

export const RerunCode = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<RerunCodeResponse, RerunCodeResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = args ? JSON.parse(args) : {};
        setToolArgs(AIToolsArgsSchema[AITool.RerunCode].safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[RerunCode] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <GridActionIcon />;
    const label = loading ? 'Rerunning code' : 'Reran code';

    const description = useMemo(() => {
      if (toolArgs?.success) {
        return toolArgs.data.sheet_name && toolArgs.data.selection
          ? `"${toolArgs.data.sheet_name}": ${toolArgs.data.selection}`
          : toolArgs.data.sheet_name && !toolArgs.data.selection
            ? `"${toolArgs.data.sheet_name}"`
            : !toolArgs.data.sheet_name && toolArgs.data.selection
              ? toolArgs.data.selection
              : 'All sheets';
      }
      return '';
    }, [toolArgs?.data?.selection, toolArgs?.data?.sheet_name, toolArgs?.success]);

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return (
        <ToolCard
          icon={icon}
          label={label}
          hasError
          description={toolArgs.error.message}
          className={className}
          compact
        />
      );
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    return <ToolCard icon={icon} label={label} description={description} className={className} compact />;
  }
);
