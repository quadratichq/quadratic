import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';
import type { z } from 'zod';

type UpdateCodeCellResponse = z.infer<(typeof aiToolsSpec)[AITool.UpdateCodeCell]['responseSchema']>;

type UpdateCodeCellProps = {
  args: string;
  loading: boolean;
};

export const UpdateCodeCell = ({ args, loading }: UpdateCodeCellProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<UpdateCodeCellResponse, UpdateCodeCellResponse>>();
  const codeCell = useRecoilValue(codeEditorCodeCellAtom);

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.UpdateCodeCell].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[UpdateCodeCell] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const estimatedNumberOfLines = useMemo(() => {
    if (toolArgs) {
      return toolArgs.data?.code_string.split('\n').length;
    } else {
      return args.split('\n').length;
    }
  }, [toolArgs, args]);

  if (loading) {
    return (
      <ToolCard
        icon={<LanguageIcon language={getLanguage(codeCell.language)} />}
        label={getLanguage(codeCell.language)}
        description={`${estimatedNumberOfLines} line` + (estimatedNumberOfLines === 1 ? '' : 's')}
        isLoading={true}
      />
    );
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={<LanguageIcon language="" />} label="Code" hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard isLoading />;
  }

  return (
    <ToolCard
      icon={<LanguageIcon language={getLanguage(codeCell.language)} />}
      label={getLanguage(codeCell.language)}
      description={`${estimatedNumberOfLines} line` + (estimatedNumberOfLines === 1 ? '' : 's')}
    />
  );
};
