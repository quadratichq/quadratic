import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { PDFIcon } from '@/shared/components/Icons';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useState } from 'react';
import type { z } from 'zod';

type PDFImportResponse = AIToolsArgs[AITool.PDFImport];

export const PDFImport = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<PDFImportResponse, PDFImportResponse>>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(AIToolsArgsSchema[AITool.PDFImport].safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[PDFImport] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const icon = <PDFIcon />;
    const label = 'Action: PDF import';

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError className={className} compact />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} compact />;
    }

    return (
      <ToolCard icon={icon} label={label} description={`${toolArgs.data.file_name}`} className={className} compact />
    );
  }
);
