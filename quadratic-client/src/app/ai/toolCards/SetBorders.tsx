import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type SetBordersResponse = z.infer<(typeof aiToolsSpec)[AITool.SetBorders]['responseSchema']>;

export const SetBorders = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<SetBordersResponse, SetBordersResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = args ? JSON.parse(args) : {};
        setToolArgs(aiToolsSpec[AITool.SetBorders].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[SetBorders] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <GridActionIcon />;
    const label = 'Set borders';

    const description = useMemo(() => {
      if (toolArgs?.success) {
        return `${toolArgs.data.sheet_name ? `"${toolArgs.data.sheet_name}"!` : ''}${toolArgs.data.selection} ${toolArgs.data.color} ${toolArgs.data.line} ${toolArgs.data.border_selection}`;
      }
      return '';
    }, [
      toolArgs?.data?.border_selection,
      toolArgs?.data?.color,
      toolArgs?.data?.line,
      toolArgs?.data?.selection,
      toolArgs?.data?.sheet_name,
      toolArgs?.success,
    ]);

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError description={toolArgs.error.message} className={className} />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    return <ToolCard icon={icon} label={label} description={description} className={className} />;
  }
);
