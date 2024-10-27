import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { MODEL_OPTIONS } from '@/app/ai/MODELS';
import { getModelIcon } from '@/app/ai/tools/helpers';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { CaretDownIcon } from '@radix-ui/react-icons';
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
    return models.filter((model) => MODEL_OPTIONS[model].enabled);
  }, []);

  const SelectedModelIcon = useMemo(() => getModelIcon(selectedMode), [selectedMode]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={loading}>
        <div className={`flex items-center text-xs ${loading ? 'opacity-60' : ''}`}>
          {selectedMode && (
            <>
              <SelectedModelIcon fontSize="inherit" />

              <span className="pl-2 pr-1">{selectedModelDisplayName}</span>
            </>
          )}
          <CaretDownIcon />
        </div>
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
          const ModelIcon = getModelIcon(enabledModel);
          return (
            <DropdownMenuCheckboxItem
              key={enabledModel}
              checked={selectedMode === enabledModel}
              onCheckedChange={() => setSelectedModel(enabledModel)}
            >
              <div className="flex w-full items-center justify-between text-xs">
                <span className="pr-4">{displayName}</span>

                <ModelIcon fontSize="inherit" />
              </div>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
