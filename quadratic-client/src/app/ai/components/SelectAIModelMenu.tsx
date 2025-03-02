import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { debug } from '@/app/debugFlags';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { cn } from '@/shared/shadcn/utils';
import { CaretDownIcon, LightningBoltIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { ModelConfig, ModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useMemo } from 'react';

interface SelectAIModelMenuProps {
  loading: boolean;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
}

export const SelectAIModelMenu = memo(({ loading, textAreaRef }: SelectAIModelMenuProps) => {
  const [selectedModel, setSelectedModel, selectedModelConfig, thinkingToggle, setThinkingToggle] = useAIModel();

  const modelConfigs = useMemo(() => {
    const configs = Object.entries(MODELS_CONFIGURATION) as [ModelKey, ModelConfig][];

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

  const handleThinkingToggle = (nextThinking: boolean) => {
    const nextModel = modelConfigs.find(
      ([_, modelConfig]) =>
        modelConfig.provider === selectedModelConfig.provider &&
        modelConfig.displayName === selectedModelConfig.displayName &&
        modelConfig.thinkingToggle === nextThinking
    );
    if (nextModel) {
      setSelectedModel(nextModel[0]);
      setThinkingToggle(nextThinking);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={loading}
          className={cn(`flex items-center text-xs text-muted-foreground`, !loading && 'hover:text-foreground')}
        >
          {selectedModelConfig.displayName}
          <CaretDownIcon />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          alignOffset={-4}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            textAreaRef.current?.focus();
          }}
        >
          {modelConfigs
            .filter(
              ([, modelConfig]) =>
                modelConfig.thinkingToggle === undefined ||
                (selectedModelConfig.thinkingToggle === undefined && modelConfig.thinkingToggle === thinkingToggle) ||
                selectedModelConfig.thinkingToggle === modelConfig.thinkingToggle
            )
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
                    <span className="pr-4">{(debug ? `${provider} - ` : '') + displayName}</span>
                  </div>
                </DropdownMenuCheckboxItem>
              );
            })}
        </DropdownMenuContent>
      </DropdownMenu>

      {canToggleThinking && (
        <Button
          size="sm"
          variant={thinking ? 'outline' : 'ghost'}
          disabled={loading}
          onClick={() => handleThinkingToggle(!thinking)}
          className="ml-1 mr-auto flex h-7 items-center gap-1 px-2 py-1 text-xs text-muted-foreground"
        >
          <LightningBoltIcon className={cn('h-3.5 w-3.5', thinking && 'text-primary')} />
          Think
        </Button>
      )}
    </>
  );
});
