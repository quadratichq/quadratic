import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useUserDataKv } from '@/app/ai/hooks/useUserDataKv';
import { aiAnalystCurrentChatUserMessagesCountAtom } from '@/app/atoms/aiAnalystAtom';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { DidYouKnowPopover } from '@/app/ui/components/DidYouKnowPopover';
import { AIIcon, ArrowDropDownIcon } from '@/shared/components/Icons';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Label } from '@/shared/shadcn/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/shared/shadcn/ui/radio-group';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { CaretDownIcon } from '@radix-ui/react-icons';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelConfig, AIModelKey, ModelMode } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

const MODEL_MODES_LABELS_DESCRIPTIONS: Record<
  Exclude<ModelMode, 'disabled' | 'others'>,
  { label: string; description: string }
> = {
  fast: { label: 'Default', description: 'Good for everyday tasks' },
  max: { label: 'Max', description: 'Smartest and most capable' },
};

interface SelectAIModelMenuProps {
  loading: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}
export const SelectAIModelMenu = memo(({ loading, textareaRef }: SelectAIModelMenuProps) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const { debugFlags } = useDebugFlags();
  const debugShowAIModelMenu = useMemo(() => debugFlags.getFlag('debugShowAIModelMenu'), [debugFlags]);

  const { modelKey: selectedModel, setModelKey: setSelectedModel, modelConfig: selectedModelConfig } = useAIModel();

  const modelConfigs = useMemo(() => {
    const configs = Object.entries(MODELS_CONFIGURATION) as [AIModelKey, AIModelConfig][];
    return debugShowAIModelMenu ? configs : configs.filter(([_, config]) => config.mode !== 'disabled');
  }, [debugShowAIModelMenu]);

  const dropdownModels = useMemo(
    () => modelConfigs.sort(([, a], [, b]) => (a.mode !== 'disabled' ? 1 : -1) + (b.mode !== 'disabled' ? -1 : 1)),
    [modelConfigs]
  );

  const selectedModelMode = useMemo(
    () => (selectedModelConfig.mode === 'disabled' ? 'max' : selectedModelConfig.mode),
    [selectedModelConfig.mode]
  );

  const setModelMode = useCallback(
    (mode: ModelMode, closePopover: boolean = true) => {
      const nextModel = modelConfigs.find(([_, modelConfig]) => modelConfig.mode === mode);

      if (nextModel) {
        setSelectedModel(nextModel[0]);
        if (closePopover) {
          setIsPopoverOpen(false);
        }
      }
    },
    [modelConfigs, setSelectedModel]
  );

  const othersModels = useMemo(() => modelConfigs.filter(([_, config]) => config.mode === 'others'), [modelConfigs]);

  const isOthersSelected = useMemo(() => selectedModelConfig.mode === 'others', [selectedModelConfig.mode]);

  const selectedModelLabel = useMemo(
    () =>
      MODEL_MODES_LABELS_DESCRIPTIONS[selectedModelMode as keyof typeof MODEL_MODES_LABELS_DESCRIPTIONS]?.label ??
      selectedModelConfig.displayName,
    [selectedModelMode, selectedModelConfig]
  );

  const { knowsAboutModelPicker, setKnowsAboutModelPicker } = useUserDataKv();
  const userMessagesCount = useRecoilValue(aiAnalystCurrentChatUserMessagesCountAtom);

  // If they've already seen the popover, don't show it.
  // Otherwise, only show it to them when they've used the AI a bit.
  const isOpenDidYouKnowDialog = useMemo(
    () => (knowsAboutModelPicker ? false : userMessagesCount > 4),
    [knowsAboutModelPicker, userMessagesCount]
  );

  if (debugShowAIModelMenu) {
    return (
      <>
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
      </>
    );
  }

  return (
    <>
      <DidYouKnowPopover
        open={!loading && isOpenDidYouKnowDialog}
        setOpen={() => setKnowsAboutModelPicker(true)}
        title="AI model choices"
        description="Default is our fastest model. Max is the smartest and most capable."
      >
        <Popover
          open={isPopoverOpen}
          onOpenChange={(open) => {
            // Don't close if we just selected "others" and the popover is being asked to close
            // This prevents the popover from closing when clicking "Others" before selecting a model
            if (isOthersSelected) {
              return;
            }
            setIsPopoverOpen(open);
          }}
        >
          {/* Needs a min-width or it shifts as the popover closes */}
          <PopoverTrigger
            className="group mr-1.5 flex h-7 min-w-24 items-center justify-end gap-0 rounded-full text-right hover:text-foreground focus-visible:outline focus-visible:outline-primary"
            onClick={() => {
              setKnowsAboutModelPicker(true);
            }}
          >
            {selectedModelLabel}
            <ArrowDropDownIcon className="group-[[aria-expanded=true]]:rotate-180" />
          </PopoverTrigger>

          <PopoverContent className="flex w-80 flex-col gap-2">
            <div className="mt-2 flex flex-col items-center">
              <AIIcon className="mb-2 text-primary" size="lg" />

              <h4 className="text-lg font-semibold">AI models</h4>

              <p className="text-sm text-muted-foreground">Choose the best fit for your needs.</p>
            </div>

            <form className="flex flex-col gap-1 rounded border border-border text-sm">
              <RadioGroup
                value={selectedModelConfig.mode === 'others' ? 'others' : selectedModelMode}
                className="flex flex-col gap-0"
                onValueChange={(value) => {
                  if (value === 'others') {
                    setModelMode('others', false);
                    // // Don't close popover when selecting "others", just select first others model
                    // if (othersModels.length > 0) {
                    //   const [firstOthersKey, firstOthersConfig] = othersModels[0];
                    //   trackEvent('[AI].model.change', { model: firstOthersConfig.model });
                    //   setSelectedModel(firstOthersKey);
                    // }
                  } else {
                    // For fast/max, close the popover
                    setModelMode(value as ModelMode, true);
                  }
                }}
              >
                {Object.entries(MODEL_MODES_LABELS_DESCRIPTIONS).map(([mode, { label, description }], i) => (
                  <Label
                    className={cn(
                      'flex cursor-pointer items-center px-4 py-3 has-[:disabled]:cursor-not-allowed has-[[aria-checked=true]]:bg-accent has-[:disabled]:text-muted-foreground',
                      i !== 0 && 'border-t border-border'
                    )}
                    key={mode}
                    htmlFor={`radio-${mode}`}
                  >
                    <RadioGroupItem value={mode} className="mr-2" id={`radio-${mode}`} />
                    <strong className="font-bold">{label}</strong>
                    <span className="ml-auto font-normal">{description}</span>
                  </Label>
                ))}

                {/* Others section */}
                <div className="border-t border-border">
                  <Label
                    className="flex cursor-pointer items-center px-4 py-3 has-[:disabled]:cursor-not-allowed has-[[aria-checked=true]]:bg-accent has-[:disabled]:text-muted-foreground"
                    htmlFor="radio-others"
                  >
                    <RadioGroupItem value="others" className="mr-2" id="radio-others" />
                    <strong className="font-bold">Others</strong>
                    <span className="ml-auto font-normal">Experimental models</span>
                  </Label>
                  {isOthersSelected && (
                    <div className="px-4 py-2">
                      <RadioGroup
                        value={selectedModel}
                        className="flex flex-col gap-1"
                        onValueChange={(value) => {
                          const modelEntry = othersModels.find(([key]) => key === value);
                          if (modelEntry) {
                            const [modelKey, modelConfig] = modelEntry;
                            trackEvent('[AI].model.change', { model: modelConfig.model });
                            setSelectedModel(modelKey);
                            setIsPopoverOpen(false);
                          }
                        }}
                      >
                        {othersModels.map(([modelKey, modelConfig]) => (
                          <Label
                            className="flex cursor-pointer items-center px-2 py-1.5 has-[:disabled]:cursor-not-allowed has-[[aria-checked=true]]:bg-accent has-[:disabled]:text-muted-foreground"
                            key={modelKey}
                            htmlFor={`radio-${modelKey}`}
                          >
                            <RadioGroupItem value={modelKey} className="mr-2" id={`radio-${modelKey}`} />
                            <span>{modelConfig.displayName}</span>
                          </Label>
                        ))}
                      </RadioGroup>
                    </div>
                  )}
                </div>
              </RadioGroup>
            </form>
          </PopoverContent>
        </Popover>
      </DidYouKnowPopover>
    </>
  );
});
