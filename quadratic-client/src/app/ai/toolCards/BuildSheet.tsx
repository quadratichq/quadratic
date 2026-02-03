import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { ViewGridIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type BuildSheetResponse = z.infer<(typeof aiToolsSpec)[AITool.BuildSheet]['responseSchema']>;

export const BuildSheet = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<BuildSheetResponse, BuildSheetResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.BuildSheet].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[BuildSheet] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <ViewGridIcon />;
    const label = loading ? 'Building spreadsheet' : 'Built spreadsheet';

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError className={className} compact />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    const { sheet_name } = toolArgs.data;
    const description = sheet_name ? `on sheet "${sheet_name}"` : 'on current sheet';

    return <ToolCard icon={icon} label={label} description={description} className={className} compact />;
  }
);
