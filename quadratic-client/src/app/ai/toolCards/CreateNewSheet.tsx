import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type CreateNewSheetResponse = z.infer<(typeof aiToolsSpec)[AITool.AddSheet]['responseSchema']>;

export const NewSheet = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<CreateNewSheetResponse, CreateNewSheetResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.AddSheet].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[CreateNewSheet] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <GridActionIcon />;
    const label = 'Create sheet';

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError description={toolArgs.error.message} className={className} />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    return (
      <ToolCard icon={icon} label={label} description={`"${toolArgs.data.sheet_name}" created`} className={className} />
    );
  }
);
