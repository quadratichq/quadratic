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

export const ContextSizeIndicator = ({ className }: ContextSizeIndicatorProps) => {
  const contextUsage = useAtomValue(contextUsageAtom);
  const { modelKey: selectedModelKey } = useAIModel();

  const usage = contextUsage.usage;
  const usageInputTokens = usage?.inputTokens ?? 0;
  const usageCacheReadTokens = usage?.cacheReadTokens ?? 0;
  const usageModelKey = usage?.modelKey;
  const hasUsage = usage != null;

  const { percentage, inputTokens, contextLimit, isVisible } = useMemo(() => {
    if (!hasUsage) {
      return { percentage: 0, inputTokens: 0, contextLimit: 0, isVisible: false };
    }
    const actualModelKey = usageModelKey ?? selectedModelKey;
    const limit = getContextLimit(actualModelKey);
    const totalInput = usageInputTokens + usageCacheReadTokens;
    const pct = Math.min((totalInput / limit) * 100, 100);
    return {
      percentage: pct,
      inputTokens: totalInput,
      contextLimit: limit,
      isVisible: true,
    };
  }, [hasUsage, usageInputTokens, usageCacheReadTokens, usageModelKey, selectedModelKey]);

  if (!isVisible) {
    return null;
  }

  const radius = 6;
  const cx = 8;
  const cy = 8;

  // Calculate the pie slice path
  // For a filled pie, we draw a path from center to edge, arc along the edge, back to center
  const getSlicePath = () => {
    if (percentage >= 100) {
      // Full circle
      return `M ${cx} ${cy} m -${radius}, 0 a ${radius},${radius} 0 1,1 ${radius * 2},0 a ${radius},${radius} 0 1,1 -${radius * 2},0`;
    }
    if (percentage <= 0) {
      return '';
    }

    const angle = (percentage / 100) * 360;
    const angleRad = (angle - 90) * (Math.PI / 180); // Start from top (-90 degrees)
    const startAngleRad = -90 * (Math.PI / 180);

    const x1 = cx + radius * Math.cos(startAngleRad);
    const y1 = cy + radius * Math.sin(startAngleRad);
    const x2 = cx + radius * Math.cos(angleRad);
    const y2 = cy + radius * Math.sin(angleRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  const gradientColor = getPercentageGradientColor(percentage);

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
            {/* Background circle */}
            <circle cx={cx} cy={cy} r={radius} fill={gradientColor} opacity="0.2" />
            {/* Filled pie slice */}
            <path d={getSlicePath()} fill={gradientColor} />
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
