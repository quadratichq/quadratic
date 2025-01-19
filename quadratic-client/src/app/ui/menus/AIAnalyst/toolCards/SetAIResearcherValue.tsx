import { ToolCard } from '@/app/ui/menus/AIAnalyst/toolCards/ToolCard';
import { SearchInsightsIcon } from '@/shared/components/Icons';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { useEffect, useState } from 'react';
import { z } from 'zod';

type SetAIResearcherValueResponse = z.infer<(typeof aiToolsSpec)[AITool.SetAIResearcherValue]['responseSchema']>;

type SetAIResearcherValueProps = {
  args: string;
  loading: boolean;
};

export const SetAIResearcherValue = ({ args, loading }: SetAIResearcherValueProps) => {
  const [toolArgs, setToolArgs] =
    useState<z.SafeParseReturnType<SetAIResearcherValueResponse, SetAIResearcherValueResponse>>();

  useEffect(() => {
    if (!loading) {
      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.SetAIResearcherValue].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[SetAIResearcherValue] Failed to parse args: ', error);
      }
    } else {
      setToolArgs(undefined);
    }
  }, [args, loading]);

  const icon = <SearchInsightsIcon />;
  const label = 'AI Researcher';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={icon} label={label} hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard icon={icon} label={label} isLoading />;
  }

  return (
    <ToolCard
      icon={icon}
      label={label}
      description={`${toolArgs.data.ai_researcher_position}, using context: ${toolArgs.data.reference_cells_selection}`}
    />
  );
};
