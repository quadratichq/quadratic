// TODO(context-size-merge): Remove this entire file after merging with main branch AI refactor
// This is a temporary implementation for QA that uses Recoil instead of Jotai

import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { aiAnalystContextUsageAtom } from '@/app/atoms/aiAnalystAtom';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { getPercentageGradientColor } from '@/shared/utils/colors';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

/**
 * Get the context limit for a specific model key.
 * Falls back to provider-based limits if model-specific limit is not found.
 */
function getContextLimit(modelKey: string | undefined): number {
  if (!modelKey) return 200000;

  // Model-specific overrides (when models within a provider have different limits)
  if (modelKey.includes('gpt-4.1')) return 1047576;
  if (modelKey.includes('gpt-5')) return 400000;
  if (modelKey.includes('o3') || modelKey.includes('o4')) return 128000;
  if (modelKey.includes('qwen') || modelKey.includes('Qwen')) return 256000;
  if (modelKey.includes('kimi') || modelKey.includes('Kimi')) return 128000;
  if (modelKey.includes('deepseek') || modelKey.includes('DeepSeek')) return 128000;

  // Provider-based defaults
  const provider = modelKey.split(':')[0];
  switch (provider) {
    case 'vertexai-anthropic':
    case 'bedrock-anthropic':
    case 'anthropic':
      return 200000;
    case 'vertexai':
    case 'geminiai':
      return 1048576;
    case 'xai':
      return 256000;
    case 'openai':
    case 'azure-openai':
      return 400000;
    case 'baseten':
    case 'fireworks':
    case 'open-router':
    case 'bedrock':
      return 128000;
    case 'quadratic':
      return 200000;
    default:
      return 200000;
  }
}

interface ContextSizeIndicatorProps {
  className?: string;
}

export const ContextSizeIndicator = ({ className }: ContextSizeIndicatorProps) => {
  const contextUsage = useRecoilValue(aiAnalystContextUsageAtom);
  const { modelKey: selectedModelKey } = useAIModel();

  const usageInputTokens = contextUsage?.inputTokens ?? 0;
  const usageCacheReadTokens = contextUsage?.cacheReadTokens ?? 0;
  const usageModelKey = contextUsage?.modelKey;

  const { percentage, inputTokens, contextLimit, isVisible } = useMemo(() => {
    if (!contextUsage) {
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
  }, [contextUsage, usageInputTokens, usageCacheReadTokens, usageModelKey, selectedModelKey]);

  if (!isVisible) {
    return null;
  }

  const radius = 6;
  const cx = 8;
  const cy = 8;

  const getSlicePath = () => {
    if (percentage >= 100) {
      return `M ${cx} ${cy} m -${radius}, 0 a ${radius},${radius} 0 1,1 ${radius * 2},0 a ${radius},${radius} 0 1,1 -${radius * 2},0`;
    }
    if (percentage <= 0) {
      return '';
    }

    const angle = (percentage / 100) * 360;
    const angleRad = (angle - 90) * (Math.PI / 180);
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
            <circle cx={cx} cy={cy} r={radius} fill={gradientColor} opacity="0.2" />
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
