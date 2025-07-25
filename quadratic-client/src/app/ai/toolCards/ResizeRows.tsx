import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type ResizeRowsResponse = z.infer<(typeof aiToolsSpec)[AITool.ResizeRows]['responseSchema']>;

export const ResizeRows = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<ResizeRowsResponse, ResizeRowsResponse>>();

    useEffect(() => {
      if (!loading) {
        try {
          const json = args ? JSON.parse(args) : {};
          setToolArgs(aiToolsSpec[AITool.ResizeRows].responseSchema.safeParse(json));
        } catch (error) {
          setToolArgs(undefined);
          console.error('[ResizeRows] Failed to parse args: ', error);
        }
      } else {
        setToolArgs(undefined);
      }
    }, [args, loading]);

    const icon = <GridActionIcon />;
    const label = 'Resize rows';

    const description = useMemo(
      () =>
        toolArgs?.data?.sheet_name && toolArgs?.data?.selection
          ? `Rows in sheet "${toolArgs?.data?.sheet_name}" within selection "${toolArgs?.data?.selection}" have been resized.`
          : toolArgs?.data?.sheet_name && !toolArgs?.data?.selection
            ? `Rows in sheet "${toolArgs.data.sheet_name}" have been resized.`
            : 'Rows in all sheets have been resized.',
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
