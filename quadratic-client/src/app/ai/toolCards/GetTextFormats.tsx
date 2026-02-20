import { ToolCardQuery } from '@/app/ai/toolCards/ToolCardQuery';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type GetTextFormatsResponse = AIToolsArgs[AITool.GetTextFormats];

export const GetTextFormats = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<GetTextFormatsResponse, GetTextFormatsResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(AIToolsArgsSchema[AITool.GetTextFormats].safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[GetTextFormats] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const label = useMemo(() => {
      const verb = loading ? 'Reading' : 'Read';
      let text =
        toolArgs?.data?.sheet_name && toolArgs?.data?.selection
          ? `${verb} formats in ${toolArgs.data.sheet_name} from ${toolArgs.data.selection}`
          : `${verb} formats...`;

      if (toolArgs?.data?.page) {
        text += ` in page ${toolArgs.data.page + 1}`;
      }
      return text + '.';
    }, [toolArgs?.data?.sheet_name, toolArgs?.data?.selection, toolArgs?.data?.page, loading]);

    if (loading) {
      return <ToolCardQuery label={label} isLoading className={className} />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCardQuery label={label} hasError className={className} />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCardQuery label={label} isLoading className={className} />;
    }

    return <ToolCardQuery label={label} className={className} />;
  }
);
