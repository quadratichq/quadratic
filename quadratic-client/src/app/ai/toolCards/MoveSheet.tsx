import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type MoveSheetResponse = z.infer<(typeof aiToolsSpec)[AITool.MoveSheet]['responseSchema']>;

export const MoveSheet = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<MoveSheetResponse, MoveSheetResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.MoveSheet].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[MoveSheet] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <GridActionIcon />;
    const label = 'Reorder sheet';

    const description = useMemo(() => {
      if (toolArgs?.success) {
        return `"${toolArgs.data.sheet_name}" ${toolArgs.data.insert_before_sheet_name ? `moved before "${toolArgs.data.insert_before_sheet_name}"` : 'moved to the end of the list'}`;
      }
      return '';
    }, [toolArgs?.data?.insert_before_sheet_name, toolArgs?.data?.sheet_name, toolArgs?.success]);

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
