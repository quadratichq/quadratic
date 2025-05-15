import { ToolCardQuery } from '@/app/ai/toolCards/ToolCardQuery';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type GetTextFormatsResponse = z.infer<(typeof aiToolsSpec)[AITool.GetTextFormats]['responseSchema']>;

type GetTextFormatsProps = {
  args: string;
  loading: boolean;
};

export const GetTextFormats = memo(({ args, loading }: GetTextFormatsProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<GetTextFormatsResponse, GetTextFormatsResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.GetTextFormats].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[GetTextFormats] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  let label =
    toolArgs?.data?.sheet_name && toolArgs?.data?.selection
      ? `Reading formats in ${toolArgs.data.sheet_name} from ${toolArgs.data.selection}`
      : 'Reading formats...';
  if (toolArgs?.data?.page) {
    label += ` in page ${toolArgs.data.page + 1}`;
  }
  label += '.';

  if (loading) {
    return <ToolCardQuery label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCardQuery label={label} hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCardQuery label={label} isLoading />;
  }

  return <ToolCardQuery label={label} />;
});
