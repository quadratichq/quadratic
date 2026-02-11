import { contextUsageAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { getPercentageGradientColor } from '@/shared/utils/colors';
import { useAtomValue } from 'jotai';
import { getContextLimit } from 'quadratic-shared/ai/models/AI_CONTEXT_LIMITS';
import { useMemo } from 'react';

interface ContextSizeIndicatorProps {
  className?: string;
}

const RADIUS = 6;
const CX = 8;
const CY = 8;

function getSlicePath(percentage: number): string {
  if (percentage >= 100) {
    return `M ${CX} ${CY} m -${RADIUS}, 0 a ${RADIUS},${RADIUS} 0 1,1 ${RADIUS * 2},0 a ${RADIUS},${RADIUS} 0 1,1 -${RADIUS * 2},0`;
  }
  if (percentage <= 0) {
    return '';
  }
  const angle = (percentage / 100) * 360;
  const angleRad = (angle - 90) * (Math.PI / 180);
  const startAngleRad = -90 * (Math.PI / 180);
  const x1 = CX + RADIUS * Math.cos(startAngleRad);
  const y1 = CY + RADIUS * Math.sin(startAngleRad);
  const x2 = CX + RADIUS * Math.cos(angleRad);
  const y2 = CY + RADIUS * Math.sin(angleRad);
  const largeArcFlag = angle > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
}

export const ContextSizeIndicator = ({ className }: ContextSizeIndicatorProps) => {
  const contextUsage = useAtomValue(contextUsageAtom);
  const { modelKey: selectedModelKey } = useAIModel();

  const { percentage, inputTokens, contextLimit, isVisible, slicePath, gradientColor } = useMemo(() => {
    const usage = contextUsage.usage;
    if (usage == null) {
      return {
        percentage: 0,
        inputTokens: 0,
        contextLimit: 0,
        isVisible: false,
        slicePath: '',
        gradientColor: getPercentageGradientColor(0),
      };
    }
    const actualModelKey = usage.modelKey ?? selectedModelKey;
    const limit = getContextLimit(actualModelKey);
    const totalInput = (usage.inputTokens ?? 0) + (usage.cacheReadTokens ?? 0);
    const pct = Math.min((totalInput / limit) * 100, 100);
    return {
      percentage: pct,
      inputTokens: totalInput,
      contextLimit: limit,
      isVisible: true,
      slicePath: getSlicePath(pct),
      gradientColor: getPercentageGradientColor(pct),
    };
  }, [contextUsage.usage, selectedModelKey]);

  if (!isVisible) {
    return null;
  }

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('flex items-center justify-center', className)}>
          <svg width="16" height="16" viewBox="0 0 16 16">
            <circle cx={CX} cy={CY} r={RADIUS} fill={gradientColor} opacity="0.2" />
            <path d={slicePath} fill={gradientColor} />
          </svg>
        </div>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent side="bottom" className="text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">Context Usage</span>
            <span>
              {formatTokens(inputTokens)} / {formatTokens(contextLimit)} tokens ({percentage.toFixed(0)}%)
            </span>
          </div>
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
};
