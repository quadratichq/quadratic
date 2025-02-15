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
import { MODEL_OPTIONS } from 'quadratic-shared/ai/models/AI_MODELS';
import { useMemo } from 'react';

interface SelectAIModelMenuProps {
  loading: boolean;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
}

export function SelectAIModelMenu({ loading, textAreaRef }: SelectAIModelMenuProps) {
  const [selectedMode, setSelectedModel] = useAIModel();
  const { displayName: selectedModelDisplayName } = useMemo(() => MODEL_OPTIONS[selectedMode], [selectedMode]);

  const enabledModels = useMemo(() => {
    const models = Object.keys(MODEL_OPTIONS) as (keyof typeof MODEL_OPTIONS)[];

    // enable all models in debug mode
    if (debug) {
      return models;
    }

    // only show enabled models in production
    return models.filter((model) => MODEL_OPTIONS[model].enabled);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={loading}
        className={cn(`flex items-center text-xs text-muted-foreground`, !loading && 'hover:text-foreground')}
      >
        {selectedMode && <>{selectedModelDisplayName}</>}
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
        {enabledModels.map((enabledModel) => {
          const displayName = MODEL_OPTIONS[enabledModel].displayName;

          return (
            <DropdownMenuCheckboxItem
              key={enabledModel}
              checked={selectedMode === enabledModel}
              onCheckedChange={() => {
                mixpanel.track('[AI].model.change', { model: enabledModel });
                setSelectedModel(enabledModel);
              }}
            >
              <div className="flex w-full items-center justify-between text-xs">
                <span className="pr-4">{displayName}</span>
              </div>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
