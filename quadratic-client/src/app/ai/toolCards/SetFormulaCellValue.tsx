import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type SetFormulaCellValueResponse = z.infer<(typeof aiToolsSpec)[AITool.SetFormulaCellValue]['responseSchema']>;

export const SetFormulaCellValue = memo(({ toolCall: { arguments: args, loading } }: { toolCall: AIToolCall }) => {
  const [toolArgs, setToolArgs] =
    useState<z.SafeParseReturnType<SetFormulaCellValueResponse, SetFormulaCellValueResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.SetFormulaCellValue].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[SetFormulaCellValue] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  if (loading) {
    return <ToolCard icon={<LanguageIcon language="Formula" />} label="Formula" isLoading={true} />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={<LanguageIcon language="Formula" />} label="Formula" hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={<LanguageIcon language="Formula" />} label="Formula" isLoading />;
  }

  const { code_cell_position } = toolArgs.data;
  return <ToolCard icon={<LanguageIcon language="Formula" />} label={'Formula'} description={code_cell_position} />;
});
