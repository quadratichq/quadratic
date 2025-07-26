import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type RerunCodeResponse = z.infer<(typeof aiToolsSpec)[AITool.RerunCode]['responseSchema']>;

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
        setToolArgs(aiToolsSpec[AITool.RerunCode].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[RerunCode] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <GridActionIcon />;
    const label = 'Rerun code';

    const description = useMemo(
      () =>
        toolArgs?.data?.sheet_name && toolArgs?.data?.selection
          ? `Code in sheet "${toolArgs.data.sheet_name}" within selection "${toolArgs.data.selection}" has been rerun.`
          : toolArgs?.data?.sheet_name && !toolArgs?.data?.selection
            ? `Code in sheet "${toolArgs.data.sheet_name}" has been rerun.`
            : 'Code in all sheets has been rerun.',
      [toolArgs?.data?.selection, toolArgs?.data?.sheet_name]
    );

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
