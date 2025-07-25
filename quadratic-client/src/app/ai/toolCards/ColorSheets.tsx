import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

type ColorSheetsResponse = z.infer<(typeof aiToolsSpec)[AITool.ColorSheets]['responseSchema']>;

export const ColorSheets = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<ColorSheetsResponse, ColorSheetsResponse>>();

    useEffect(() => {
      if (!loading) {
        try {
          const json = JSON.parse(args);
          setToolArgs(aiToolsSpec[AITool.ColorSheets].responseSchema.safeParse(json));
        } catch (error) {
          setToolArgs(undefined);
          console.error('[ColorSheets] Failed to parse args: ', error);
        }
      } else {
        setToolArgs(undefined);
      }
    }, [args, loading]);

    const icon = <GridActionIcon />;
    const label = 'Color sheets';

    const results = useMemo(() => {
      if (!toolArgs?.data) {
        return '';
      }
      let results = 'Changed sheet colors: ';
      for (const key in toolArgs.data.sheet_name_to_color) {
        results += `"${key}"${key !== Object.keys(toolArgs.data.sheet_name_to_color)[Object.keys(toolArgs.data.sheet_name_to_color).length - 1] ? ', ' : ''}`;
      }
      return results + '\n';
    }, [toolArgs?.data]);

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError description={toolArgs.error.message} className={className} />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    return <ToolCard icon={icon} label={label} description={results} className={className} />;
  }
);
