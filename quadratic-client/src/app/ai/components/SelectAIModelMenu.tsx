import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { PsychologyIcon, SpeedIcon } from '@/shared/components/Icons';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { CaretDownIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelConfig, AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useMemo } from 'react';

const SMART_MODEL: AIModelKey = 'quadratic:quadratic-auto:thinking-toggle-off';
const FAST_MODEL: AIModelKey = 'vertexai:gemini-2.5-flash:thinking-toggle-on';

interface SelectAIModelMenuProps {
  loading: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const SelectAIModelMenu = memo(({ loading, textareaRef }: SelectAIModelMenuProps) => {
  const [selectedModel, setSelectedModel, selectedModelConfig] = useAIModel();
  const { getFlag } = useDebugFlags();
  const modelConfigs = useMemo(() => {
    const configs = Object.entries(MODELS_CONFIGURATION) as [AIModelKey, AIModelConfig][];

    // enable all models in debug mode
    if (getFlag('debug')) {
      return configs;
    }

    // only show enabled models in production
    return configs.filter(([_, config]) => config.enabled);
  }, [getFlag]);

  const isFast = useMemo(() => selectedModel === FAST_MODEL, [selectedModel]);

  const handleSetSmart = useCallback(() => {
    if (selectedModel !== SMART_MODEL) {
      setSelectedModel(SMART_MODEL);
      mixpanel.track('[AI].mode.change', { mode: 'smart' });
    }
  }, [selectedModel, setSelectedModel]);

  const handleSetFast = useCallback(() => {
    if (selectedModel !== FAST_MODEL) {
      setSelectedModel(FAST_MODEL);
      mixpanel.track('[AI].mode.change', { mode: 'fast' });
    }
  }, [selectedModel, setSelectedModel]);

  return (
    <>
      <TooltipPopover
        label={isFast ? 'Use a smarter model for complex prompts' : 'Use a faster model for simple prompts'}
      >
        <div className="mr-auto flex h-7 items-center rounded-full bg-muted p-0.5 text-xs font-normal">
          <button
            onClick={handleSetFast}
            disabled={loading}
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors',
              isFast ? 'bg-border text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <SpeedIcon />
            <span>Fast</span>
          </button>
          <button
            onClick={handleSetSmart}
            disabled={loading}
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors',
              !isFast ? 'bg-border text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <PsychologyIcon />
            <span>Smart</span>
          </button>
        </div>
      </TooltipPopover>

      {getFlag('debug') && (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={loading}
            className={cn(`mr-1 flex items-center text-xs text-muted-foreground`, !loading && 'hover:text-foreground')}
          >
            {selectedModelConfig.displayName}
            <CaretDownIcon />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            alignOffset={-4}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              textareaRef.current?.focus();
            }}
          >
            {modelConfigs
              .filter(
                ([, modelConfig]) =>
                  modelConfig.thinkingToggle === undefined ||
                  (selectedModelConfig.thinkingToggle === undefined && modelConfig.thinkingToggle === !isFast) ||
                  selectedModelConfig.thinkingToggle === !isFast
              )
              .sort(([, a], [, b]) => (a.enabled ? 1 : -1) + (b.enabled ? -1 : 1))
              .map(([key, modelConfig]) => {
                const { model, displayName, provider } = modelConfig;

                return (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={selectedModel === key}
                    onCheckedChange={() => {
                      mixpanel.track('[AI].model.change', { model });
                      setSelectedModel(key);
                    }}
                  >
                    <div className="flex w-full items-center justify-between text-xs">
                      <span className="pr-4">
                        {(getFlag('debug') ? `${modelConfig.enabled ? '' : '(debug) '}${provider} - ` : '') +
                          displayName}
                      </span>
                    </div>
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
});
