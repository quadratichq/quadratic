import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { GridActionIcon } from '@/shared/components/Icons';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type TableMetaResponse = AIToolsArgs[AITool.TableMeta];

export const TableMeta = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<TableMetaResponse, TableMetaResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(AIToolsArgsSchema[AITool.TableMeta].safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[TableMeta] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <GridActionIcon />;
    const label = 'Table changes';

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError className={className} compact />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    let description = `Table at ${toolArgs.data.table_location}`;
    const actions = [];
    if (toolArgs.data.new_table_name) {
      actions.push(`renamed to "${toolArgs.data.new_table_name}"`);
    }
    if (toolArgs.data.first_row_is_column_names !== undefined) {
      actions.push(`first row changed to ${toolArgs.data.first_row_is_column_names ? 'column names' : 'data'}`);
    }
    if (toolArgs.data.show_name !== undefined) {
      actions.push(`${toolArgs.data.show_name ? 'shows' : 'hides'} name row`);
    }
    if (toolArgs.data.show_columns !== undefined) {
      actions.push(`${toolArgs.data.show_columns ? 'shows' : 'hides'} columns row`);
    }
    if (toolArgs.data.alternating_row_colors !== undefined) {
      actions.push(`changed to ${toolArgs.data.alternating_row_colors ? 'show' : 'not show'} alternating row colors`);
    }
    description += ` ${actions.join(', ')}`;

    return <ToolCard icon={icon} label={label} description={description} className={className} compact />;
  }
);
