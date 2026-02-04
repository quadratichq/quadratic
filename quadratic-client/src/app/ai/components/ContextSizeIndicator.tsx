import { contextUsageAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { getPercentageGradientColor } from '@/shared/utils/colors';
import { useAtomValue } from 'jotai';
import type { AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { useMemo } from 'react';

// Context limits by model (input tokens)
// Values researched from official documentation (January 2025):
// - Claude 4.5 (Opus/Sonnet/Haiku): 200K tokens
// - GPT-4.1: 1M tokens, GPT-5/5.2: 400K tokens, o3/o4-mini: 128K tokens
// - Gemini 2.5 Flash/Pro: 1M tokens
// - Grok 4: 256K tokens
// - DeepSeek V3/R1: 128K tokens
// - Qwen3-Coder-480B: 256K tokens (native)
// - Kimi K2: 128K tokens

/**
 * Get the context limit for a specific model key.
 * Falls back to provider-based limits if model-specific limit is not found.
 */
function getContextLimit(modelKey: AIModelKey | undefined): number {
  if (!modelKey) return 200000;

  // Model-specific overrides (when models within a provider have different limits)
  // GPT-4.1 has 1M, GPT-5/5.2 has 400K
  if (modelKey.includes('gpt-4.1')) return 1047576;
  if (modelKey.includes('gpt-5')) return 400000;
  if (modelKey.includes('o3') || modelKey.includes('o4')) return 128000;

  // Qwen3-Coder has 256K
  if (modelKey.includes('qwen') || modelKey.includes('Qwen')) return 256000;

  // Kimi K2 has 128K
  if (modelKey.includes('kimi') || modelKey.includes('Kimi')) return 128000;

  // DeepSeek has 128K
  if (modelKey.includes('deepseek') || modelKey.includes('DeepSeek')) return 128000;

  // Provider-based defaults
  const provider = modelKey.split(':')[0];
  switch (provider) {
    // Claude 4.5 models - 200K context window
    case 'vertexai-anthropic':
    case 'bedrock-anthropic':
    case 'anthropic':
      return 200000;

    // Gemini 2.5 models - 1M context window
    case 'vertexai':
    case 'geminiai':
      return 1048576;

    // Grok 4 - 256K context window
    case 'xai':
      return 256000;

    // OpenAI/Azure - default to 400K (GPT-5 series)
    case 'openai':
    case 'azure-openai':
      return 400000;

    // Various hosted models - conservative 128K
    case 'baseten':
    case 'fireworks':
    case 'open-router':
    case 'bedrock':
      return 128000;

    // Quadratic auto routes to various models
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
  const contextUsage = useAtomValue(contextUsageAtom);
  const { modelKey: selectedModelKey } = useAIModel();

  const usage = contextUsage.usage;

  // Use primitive values as dependencies for better reactivity
  const usageInputTokens = usage?.inputTokens ?? 0;
  const usageCacheReadTokens = usage?.cacheReadTokens ?? 0;
  const usageModelKey = usage?.modelKey;

  const { percentage, inputTokens, contextLimit, isVisible } = useMemo(() => {
    if (!usage) {
      return { percentage: 0, inputTokens: 0, contextLimit: 0, isVisible: false };
    }

    // Use the model key from the usage response (actual model used) or fall back to selected model
    const actualModelKey = usageModelKey ?? selectedModelKey;
    const limit = getContextLimit(actualModelKey);

    // Calculate total input tokens (including cache reads)
    const totalInput = usageInputTokens + usageCacheReadTokens;
    const pct = Math.min((totalInput / limit) * 100, 100);

    return {
      percentage: pct,
      inputTokens: totalInput,
      contextLimit: limit,
      isVisible: true,
    };
  }, [usage, usageInputTokens, usageCacheReadTokens, usageModelKey, selectedModelKey]);

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
