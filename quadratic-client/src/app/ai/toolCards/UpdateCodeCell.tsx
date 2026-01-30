import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { AITool, AIToolsArgsSchema, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';
import type { z } from 'zod';

type UpdateCodeCellResponse = AIToolsArgs[AITool.UpdateCodeCell];

export const UpdateCodeCell = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<UpdateCodeCellResponse, UpdateCodeCellResponse>>();
    const codeCell = useRecoilValue(codeEditorCodeCellAtom);

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(AIToolsArgsSchema[AITool.UpdateCodeCell].safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[UpdateCodeCell] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const estimatedNumberOfLines = useMemo(() => {
      if (toolArgs) {
        return toolArgs.data?.code_string.split('\n').length;
      } else {
        return args.split('\\n').length;
      }
    }, [toolArgs, args]);

    const language = getLanguage(codeCell.language);
    const label = loading ? 'Updating code' : `Updated code ${language}`;

    const handleClick = useCallback(() => {
      try {
        sheets.sheet.cursor.moveTo(codeCell.pos.x, codeCell.pos.y);
      } catch (e) {
        console.warn('Failed to select cell:', e);
      }
    }, [codeCell.pos.x, codeCell.pos.y]);

    if (loading) {
      return (
        <ToolCard
          icon={<LanguageIcon language={language} />}
          label={label}
          description={`${estimatedNumberOfLines} line` + (estimatedNumberOfLines === 1 ? '' : 's')}
          isLoading={true}
          className={className}
          compact
        />
      );
    }

    if (!!toolArgs && !toolArgs.success) {
      return (
        <ToolCard icon={<LanguageIcon language="" />} label="Updated code" hasError className={className} compact />
      );
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard isLoading className={className} compact />;
    }

    return (
      <ToolCard
        icon={<LanguageIcon language={language} />}
        label={label}
        description={`${estimatedNumberOfLines} line` + (estimatedNumberOfLines === 1 ? '' : 's')}
        className={className}
        compact
        onClick={handleClick}
      />
    );
  }
);
