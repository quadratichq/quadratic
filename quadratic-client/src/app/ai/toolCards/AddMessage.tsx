import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { TableIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type AddMessageResponse = z.infer<(typeof aiToolsSpec)[AITool.AddMessage]['responseSchema']>;

export const AddMessage = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<AddMessageResponse, AddMessageResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.AddMessage].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[AddMessage] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <TableIcon />;
    const label = 'Add Message';

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError className={className} />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    const { selection } = toolArgs.data;
    const description = `Added a message to ${selection}`;
    return (
      <ToolCard
        icon={icon}
        label={
          <span>
            {label} <span className="ml-1 font-normal text-muted-foreground">{selection}</span>
          </span>
        }
        description={description}
        className={className}
      />
    );
  }
);
