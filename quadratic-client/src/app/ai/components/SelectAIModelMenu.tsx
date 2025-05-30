import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { debug } from '@/app/debugFlags';
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

  const modelConfigs = useMemo(() => {
    const configs = Object.entries(MODELS_CONFIGURATION) as [AIModelKey, AIModelConfig][];

    // enable all models in debug mode
    if (debug) {
      return configs;
    }

    // only show enabled models in production
    return configs.filter(([_, config]) => config.enabled);
  }, []);

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
      {debug && (
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
                        {(debug ? `${modelConfig.enabled ? '' : '(debug) '}${provider} - ` : '') + displayName}
                      </span>
                    </div>
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {canToggleThinking && (
        <TooltipPopover label="Extended thinking for complex prompts">
          <Toggle
            aria-label="Extended thinking"
            size="sm"
            disabled={loading}
            onClick={() => handleThinkingToggle(!thinkingToggle)}
            className={cn(
              thinking && '!bg-border !text-primary',
              !thinking && 'text-muted-foreground hover:text-foreground',
              'mr-auto flex h-6 items-center !gap-0 px-1.5 py-1 text-xs font-normal'
            )}
          >
            <LightbulbIcon className={cn('mr-0.5 !flex !h-4 !w-4 items-center !text-base')} />
            Think
          </Toggle>
        </TooltipPopover>
      )}
    </>
  );
});
