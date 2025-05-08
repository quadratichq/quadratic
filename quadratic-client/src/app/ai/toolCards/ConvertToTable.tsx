import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { TableIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { useEffect, useState } from 'react';
import type { z } from 'zod';

type ConvertToTableResponse = z.infer<(typeof aiToolsSpec)[AITool.ConvertToTable]['responseSchema']>;

type ConvertToTableProps = {
  args: string;
  loading: boolean;
};

export const ConvertToTable = ({ args, loading }: ConvertToTableProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<ConvertToTableResponse, ConvertToTableResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.ConvertToTable].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[ConvertToTable] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <TableIcon />;
  const label = 'Convert to Table';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  const { table_name, selection } = toolArgs.data;
  return (
    <ToolCard
      icon={icon}
      label={
        <span>
          {label} <span className="text-muted-foreground">| {table_name}</span>
        </span>
      }
      description={`Converting ${selection} to data table named ${table_name}`}
    />
  );
};
