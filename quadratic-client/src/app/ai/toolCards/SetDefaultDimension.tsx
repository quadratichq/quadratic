import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';

const DEFAULT_DIMENSION_TOOLS = [AITool.SetDefaultColumnWidth, AITool.SetDefaultRowHeight] as const;
type DefaultDimensionTool = (typeof DEFAULT_DIMENSION_TOOLS)[number];

function isDefaultDimensionTool(name: string): name is DefaultDimensionTool {
  return DEFAULT_DIMENSION_TOOLS.includes(name as DefaultDimensionTool);
}

const LABELS: Record<DefaultDimensionTool, { loading: string; idle: string }> = {
  [AITool.SetDefaultColumnWidth]: {
    loading: 'Setting default column width',
    idle: 'Set default column width',
  },
  [AITool.SetDefaultRowHeight]: {
    loading: 'Setting default row height',
    idle: 'Set default row height',
  },
};

type ResponseSchema = z.infer<(typeof aiToolsSpec)[DefaultDimensionTool]['responseSchema']>;

export const SetDefaultDimension = memo(
  ({ toolCall: { name, arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const tool = isDefaultDimensionTool(name) ? name : AITool.SetDefaultColumnWidth;
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<ResponseSchema, ResponseSchema>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = args ? JSON.parse(args) : {};
        setToolArgs(aiToolsSpec[tool].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[SetDefaultDimension] Failed to parse args: ', error);
      }
    }, [args, loading, tool]);

    const icon = <GridActionIcon />;
    const label = loading ? LABELS[tool].loading : LABELS[tool].idle;

    const description = useMemo(() => {
      if (toolArgs?.success) {
        const sheetName = toolArgs.data.sheet_name ? `"${toolArgs.data.sheet_name}" ` : '';
        return `${sheetName}${toolArgs.data.size}px`;
      }
      return '';
    }, [toolArgs?.data?.sheet_name, toolArgs?.data?.size, toolArgs?.success]);

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return (
        <ToolCard
          icon={icon}
          label={label}
          hasError
          description={toolArgs.error.message}
          className={className}
          compact
        />
      );
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    return <ToolCard icon={icon} label={label} description={description} className={className} compact />;
  }
);
