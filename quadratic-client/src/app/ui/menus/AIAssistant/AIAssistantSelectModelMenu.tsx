import { aiAssistantLoadingAtom } from '@/app/atoms/aiAssistantAtom';
import { Anthropic, OpenAI } from '@/app/ui/icons';
import { MODEL_OPTIONS } from '@/app/ui/menus/AIAssistant/MODELS';
import { useAIAssistantModel } from '@/app/ui/menus/AIAssistant/hooks/useAIAssistantModel';
import { isAnthropicModel } from '@/app/ui/menus/AIAssistant/hooks/useAIRequestToAPI';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { CaretDownIcon } from '@radix-ui/react-icons';
import { useEffect, useMemo } from 'react';
import { useRecoilValue } from 'recoil';

interface AIAssistantSelectModelMenuProps {
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
}

export function AIAssistantSelectModelMenu({ textAreaRef }: AIAssistantSelectModelMenuProps) {
  const [selectedMode, setSelectedModel] = useAIAssistantModel();
  // If the model is not enabled, set the model to the first enabled model
  useEffect(() => {
    if (!MODEL_OPTIONS[selectedMode].enabled) {
      const models = Object.keys(MODEL_OPTIONS) as (keyof typeof MODEL_OPTIONS)[];
      const newModel = models.find((model) => MODEL_OPTIONS[model].enabled);
      if (newModel) {
        setSelectedModel(newModel);
      }
    }
  }, [selectedMode, setSelectedModel]);

  const loading = useRecoilValue(aiAssistantLoadingAtom);

  const { displayName: selectedModelDisplayName } = useMemo(() => MODEL_OPTIONS[selectedMode], [selectedMode]);

  const enabledModels = useMemo(() => {
    const models = Object.keys(MODEL_OPTIONS) as (keyof typeof MODEL_OPTIONS)[];
    return models.filter((model) => MODEL_OPTIONS[model].enabled);
  }, []);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={loading}>
        <div className={`flex items-center text-xs ${loading ? 'opacity-60' : ''}`}>
          {selectedMode && (
            <>
              {isAnthropicModel(selectedMode) ? <Anthropic fontSize="inherit" /> : <OpenAI fontSize="inherit" />}
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
          return (
            <DropdownMenuCheckboxItem
              key={enabledModel}
              checked={selectedMode === enabledModel}
              onCheckedChange={() => setSelectedModel(enabledModel)}
            >
              <div className="flex w-full items-center justify-between text-xs">
                <span className="pr-4">{displayName}</span>
                {isAnthropicModel(enabledModel) ? <Anthropic fontSize="inherit" /> : <OpenAI fontSize="inherit" />}
              </div>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
