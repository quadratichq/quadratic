import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type TableColumnNamesResponse = z.infer<(typeof aiToolsSpec)[AITool.TableColumnNames]['responseSchema']>;

type TableColumnNamesProps = {
  args: string;
  loading: boolean;
};

export const TableColumnNames = memo(({ args, loading }: TableColumnNamesProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<TableColumnNamesResponse, TableColumnNamesResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.TableColumnNames].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[TableColumnNames] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <GridActionIcon />;
  const label = 'Table column names';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  let description = `Table at ${toolArgs.data.table_location} renamed columns`;

  return <ToolCard icon={icon} label={label} description={description} />;
});
