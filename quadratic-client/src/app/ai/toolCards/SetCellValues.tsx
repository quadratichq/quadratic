import { getRowColSentence, ToolCard } from '@/app/ai/toolCards/ToolCard';
import { aiViewAtom } from '@/app/atoms/gridSettingsAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { rectToA1 } from '@/app/quadratic-core/quadratic_core';
import { AILightWeight } from '@/app/ui/menus/AIAnalyst/AILightWeight';
import { TableRowsIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import type { z } from 'zod';

type SetCellValuesResponse = z.infer<(typeof aiToolsSpec)[AITool.SetCellValues]['responseSchema']>;

export const SetCellValues = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<SetCellValuesResponse, SetCellValuesResponse>>();
    const aiView = useRecoilValue(aiViewAtom);

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.SetCellValues].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[SetCellValues] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <TableRowsIcon />;
    const label = 'Data';

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError className={className} />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    const { top_left_position, cell_values } = toolArgs.data;
    const rows = cell_values.length;
    const cols = cell_values.reduce((max, row) => Math.max(max, row.length), 0);
    let a1 = 'A1';
    try {
      const topLeftSelection = sheets.stringToSelection(top_left_position, sheets.current);
      const start = topLeftSelection.getCursor();
      a1 = rectToA1({
        min: {
          x: BigInt(start.x),
          y: BigInt(start.y),
        },
        max: {
          x: BigInt(start.x + cols - 1),
          y: BigInt(start.y + rows - 1),
        },
      });
    } catch {}

    return (
      <>
        <ToolCard
          icon={icon}
          label={label}
          description={`${getRowColSentence({ rows, cols })} at ${top_left_position}`}
          className={className}
        />
        {aiView && <AILightWeight height={100} a1={a1} />}
      </>
    );
  }
);
