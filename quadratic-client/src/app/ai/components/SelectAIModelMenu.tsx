import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { LightbulbIcon } from '@/shared/components/Icons';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Toggle } from '@/shared/shadcn/ui/toggle';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { CaretDownIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelConfig, AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useMemo } from 'react';

interface SelectAIModelMenuProps {
  loading: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const SelectAIModelMenu = memo(({ loading, textareaRef }: SelectAIModelMenuProps) => {
  const [selectedModel, setSelectedModel, selectedModelConfig, thinkingToggle, setThinkingToggle] = useAIModel();
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

  const canToggleThinking = useMemo(
    () => selectedModelConfig.thinkingToggle !== undefined,
    [selectedModelConfig.thinkingToggle]
  );

  const thinking = useMemo(() => !!selectedModelConfig.thinkingToggle, [selectedModelConfig.thinkingToggle]);

  const handleThinkingToggle = useCallback(
    (thinkingToggle: boolean) => {
      const nextModelKey = thinkingToggle
        ? selectedModel.replace(':thinking-toggle-off', ':thinking-toggle-on')
        : selectedModel.replace(':thinking-toggle-on', ':thinking-toggle-off');

      const nextModel = modelConfigs.find(
        ([modelKey, modelConfig]) => modelKey === nextModelKey && modelConfig.thinkingToggle === thinkingToggle
      );

      if (nextModel) {
        setSelectedModel(nextModel[0]);
        setThinkingToggle(thinkingToggle);
      }
    },
    [modelConfigs, selectedModel, setSelectedModel, setThinkingToggle]
  );

  return (
    <>
      {canToggleThinking && (
        <TooltipPopover label="Extended thinking for complex prompts">
          <Toggle
            aria-label="Extended thinking"
            size="sm"
            disabled={loading}
            onClick={() => handleThinkingToggle(!thinkingToggle)}
            className={cn(
              thinking && '!bg-border !text-primary',
              !thinking && 'w-7 hover:text-foreground',
              'mr-auto flex h-7 items-center !gap-0 rounded-full px-1 py-1 text-xs font-normal'
            )}
          >
            <LightbulbIcon />
            {thinking && <span className="mr-1">Think</span>}
          </Toggle>
        </TooltipPopover>
      )}

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
                  (selectedModelConfig.thinkingToggle === undefined && modelConfig.thinkingToggle === thinkingToggle) ||
                  selectedModelConfig.thinkingToggle === modelConfig.thinkingToggle
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
