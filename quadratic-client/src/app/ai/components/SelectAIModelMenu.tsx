import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useUserDataKv } from '@/app/ai/hooks/useUserDataKv';

import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { DidYouKnowPopover } from '@/app/ui/components/DidYouKnowPopover';
import { AIIcon, ArrowDropDownIcon, LightbulbIcon } from '@/shared/components/Icons';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Label } from '@/shared/shadcn/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/shared/shadcn/ui/radio-group';
import { Toggle } from '@/shared/shadcn/ui/toggle';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { CaretDownIcon } from '@radix-ui/react-icons';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelConfig, AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useMemo } from 'react';

// Specific models to show in the UI
const FEATURED_MODELS: { [key: string]: { displayName: string; provider: string } } = {
  'baseten:deepseek-ai/DeepSeek-V3.1': { displayName: 'Default', provider: 'Quadratic' },
  'anthropic:claude-sonnet-4:thinking-toggle-off': { displayName: 'Claude Sonnet 4', provider: 'Anthropic' },
  'openai:gpt-4.1-2025-04-14': { displayName: 'GPT-4.1', provider: 'OpenAI' },
  'openai:gpt-5-2025-08-07': { displayName: 'GPT-5', provider: 'OpenAI' },
  'openai:o3-2025-04-16': { displayName: 'o3', provider: 'OpenAI' },
};

interface SelectAIModelMenuProps {
  loading: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}
export const SelectAIModelMenu = memo(({ loading, textareaRef }: SelectAIModelMenuProps) => {
  const { debugFlags } = useDebugFlags();
  const debugShowAIModelMenu = useMemo(() => debugFlags.getFlag('debugShowAIModelMenu'), [debugFlags]);

  const {
    modelKey: selectedModel,
    setModelKey: setSelectedModel,
    modelConfig: selectedModelConfig,
    thinkingToggle,
    setThinkingToggle,
  } = useAIModel();

  const thinking = useMemo(() => !!selectedModelConfig.thinkingToggle, [selectedModelConfig.thinkingToggle]);
  const canToggleThinking = useMemo(
    () => selectedModelConfig.thinkingToggle !== undefined,
    [selectedModelConfig.thinkingToggle]
  );

  const modelConfigs = useMemo(() => {
    const configs = Object.entries(MODELS_CONFIGURATION) as [AIModelKey, AIModelConfig][];
    return debugShowAIModelMenu ? configs : configs.filter(([_, config]) => config.mode !== 'disabled');
  }, [debugShowAIModelMenu]);

  const dropdownModels = useMemo(
    () =>
      modelConfigs
        .filter(
          ([, modelConfig]) =>
            modelConfig.thinkingToggle === undefined ||
            (selectedModelConfig.thinkingToggle === undefined && modelConfig.thinkingToggle === thinkingToggle) ||
            selectedModelConfig.thinkingToggle === modelConfig.thinkingToggle
        )
        .sort(([, a], [, b]) => (a.mode === 'enabled' ? -1 : 1) + (b.mode === 'enabled' ? 1 : -1)),
    [modelConfigs, selectedModelConfig.thinkingToggle, thinkingToggle]
  );

  const handleThinkingToggle = useCallback(
    (nextThinkingToggle: boolean) => {
      const nextModelKey = nextThinkingToggle
        ? selectedModel.replace(':thinking-toggle-off', ':thinking-toggle-on')
        : selectedModel.replace(':thinking-toggle-on', ':thinking-toggle-off');

      const nextModel = modelConfigs.find(
        ([modelKey, modelConfig]) => modelKey === nextModelKey && modelConfig.thinkingToggle === nextThinkingToggle
      );

      if (nextModel) {
        setSelectedModel(nextModel[0]);
        setThinkingToggle(nextThinkingToggle);
      }
    },
    [modelConfigs, selectedModel, setSelectedModel, setThinkingToggle]
  );

  const selectedModelDisplayInfo = useMemo(() => {
    return FEATURED_MODELS[selectedModel] || { displayName: selectedModelConfig.displayName, provider: 'Unknown' };
  }, [selectedModel, selectedModelConfig.displayName]);

  const { setKnowsAboutModelPicker } = useUserDataKv();
  // Disabled: AI tooltip after 5 prompts
  const isOpenDidYouKnowDialog = useMemo(() => false, []);

  return (
    <>
      {canToggleThinking ? (
        <TooltipPopover label="Extended thinking for complex prompts">
          <Toggle
            aria-label="Extended thinking"
            size="sm"
            disabled={loading}
            onClick={() => handleThinkingToggle(!thinking)}
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
      ) : (
        <div className="mr-auto flex h-7 items-center !gap-0 rounded-full px-1 py-1 text-xs font-normal" />
      )}

      {debugShowAIModelMenu ? (
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
            {dropdownModels.map(([key, modelConfig]) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={selectedModel === key}
                onCheckedChange={() => {
                  trackEvent('[AI].model.change', { model: modelConfig.model });
                  setSelectedModel(key);
                }}
              >
                <div className="flex w-full items-center justify-between text-xs">
                  <span className="pr-4">
                    {(debugShowAIModelMenu
                      ? `${modelConfig.mode === 'disabled' ? '(debug) ' : ''}${modelConfig.provider} - `
                      : '') + modelConfig.displayName}
                  </span>
                </div>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <DidYouKnowPopover
          open={!loading && isOpenDidYouKnowDialog}
          setOpen={() => setKnowsAboutModelPicker(true)}
          title="AI model choices"
          description="Choose from different AI models with varying capabilities and speeds."
        >
          <Popover>
            {/* Needs a min-width or it shifts as the popover closes */}
            <PopoverTrigger
              className="group mr-1.5 flex h-7 min-w-24 items-center justify-end gap-0 rounded-full text-right hover:text-foreground focus-visible:outline focus-visible:outline-primary"
              onClick={() => {
                setKnowsAboutModelPicker(true);
              }}
            >
              Model: {selectedModelDisplayInfo.displayName}
              <ArrowDropDownIcon className="group-[[aria-expanded=true]]:rotate-180" />
            </PopoverTrigger>

            <PopoverContent className="flex w-80 flex-col gap-2">
              <div className="mt-2 flex flex-col items-center">
                <AIIcon className="mb-2 text-primary" size="lg" />

                <h4 className="text-lg font-semibold">AI models</h4>

                <p className="text-sm text-muted-foreground">Choose the best fit for your needs.</p>
              </div>

              <form className="flex flex-col gap-1 rounded border border-border text-sm">
                <RadioGroup value={selectedModel} className="flex flex-col gap-0">
                  {Object.entries(FEATURED_MODELS).map(([modelKey, { displayName, provider }], i) => (
                    <Label
                      className={cn(
                        'flex cursor-pointer items-center px-4 py-3 has-[:disabled]:cursor-not-allowed has-[[aria-checked=true]]:bg-accent has-[:disabled]:text-muted-foreground',
                        i !== 0 && 'border-t border-border'
                      )}
                      key={modelKey}
                      onPointerDown={() => {
                        trackEvent('[AI].model.change', { model: modelKey });
                        setSelectedModel(modelKey as AIModelKey);
                      }}
                    >
                      <RadioGroupItem value={modelKey} className="mr-2" />
                      <strong className="font-bold">{displayName}</strong>
                      <span className="ml-auto font-normal">{provider}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </form>
            </PopoverContent>
          </Popover>
        </DidYouKnowPopover>
      )}
    </>
  );
});
