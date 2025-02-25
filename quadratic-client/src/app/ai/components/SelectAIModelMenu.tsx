import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { debug } from '@/app/debugFlags';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { cn } from '@/shared/shadcn/utils';
import { CaretDownIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { ModelConfig, ModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { useMemo } from 'react';

interface SelectAIModelMenuProps {
  loading: boolean;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
}

export function SelectAIModelMenu({ loading, textAreaRef }: SelectAIModelMenuProps) {
  const [selectedModel, setSelectedModel, selectedModelConfig] = useAIModel();

  const modelConfigs = useMemo(() => {
    const configs = Object.entries(MODELS_CONFIGURATION) as [ModelKey, ModelConfig][];

    // enable all models in debug mode
    if (debug) {
      return configs;
    }

    // only show enabled models in production
    return configs.filter(([_, config]) => config.enabled);
  }, []);

  return (
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
        {modelConfigs.map(([key, modelConfig]) => {
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
  );
}
