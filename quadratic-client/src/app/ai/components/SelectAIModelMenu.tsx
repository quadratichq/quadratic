/* eslint-disable @typescript-eslint/no-unused-vars */
import { currentChatUserMessagesCountAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { ContextSizeIndicator } from '@/app/ai/components/ContextSizeIndicator';
import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useUserDataKv } from '@/app/ai/hooks/useUserDataKv';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { DidYouKnowPopover } from '@/app/ui/components/DidYouKnowPopover';
import { showUpgradeDialogAtom } from '@/shared/atom/showUpgradeDialogAtom';
import { teamBillingAtom } from '@/shared/atom/teamBillingAtom';
import { ArrowDropDownIcon } from '@/shared/components/Icons';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
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
import { useAtomValue, useSetAtom } from 'jotai';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelConfig, AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useMemo, useState } from 'react';

type UIModels = 'max' | 'others';
const MODEL_MODES_LABELS_DESCRIPTIONS: Record<UIModels, { label: string; description: string }> = {
  max: { label: 'Auto', description: 'Claude Opus 4.6' },
  others: { label: 'Others', description: 'Experimental models' },
};

interface SelectAIModelMenuProps {
  loading: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}
export const SelectAIModelMenu = memo(({ loading }: SelectAIModelMenuProps) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const {
    userMakingRequest,
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();
  const restrictedModel = userMakingRequest.restrictedModel;
  const { isOnPaidPlan } = useAtomValue(teamBillingAtom);
  const { debugFlags } = useDebugFlags();
  const debugShowAIModelMenu = useMemo(() => debugFlags.getFlag('debugShowAIModelMenu'), [debugFlags]);
  const setShowUpgradeDialog = useSetAtom(showUpgradeDialogAtom);
  const { modelType, othersModelKey, setModel, selectedModelConfig, defaultOthersModelKey } = useAIModel();

  const modelConfigs = useMemo(() => {
    const configs = Object.entries(MODELS_CONFIGURATION) as [AIModelKey, AIModelConfig][];
    return debugShowAIModelMenu ? configs : configs.filter(([_, config]) => config.mode !== 'disabled');
  }, [debugShowAIModelMenu]);

  const dropdownModels = useMemo(
    () => modelConfigs.sort(([, a], [, b]) => (a.mode !== 'disabled' ? 1 : -1) + (b.mode !== 'disabled' ? -1 : 1)),
    [modelConfigs]
  );

  const othersModels = useMemo(() => modelConfigs.filter(([_, config]) => config.mode === 'others'), [modelConfigs]);

  const { knowsAboutModelPicker, setKnowsAboutModelPicker } = useUserDataKv();
  const userMessagesCount = useAtomValue(currentChatUserMessagesCountAtom);

  // If they've already seen the popover, don't show it.
  // Otherwise, only show it to them when they've used the AI a bit.
  const isOpenDidYouKnowDialog = useMemo(
    () => (knowsAboutModelPicker ? false : userMessagesCount > 4),
    [knowsAboutModelPicker, userMessagesCount]
  );

  // Debug mode where any non-disabled model is shown
  if (debugShowAIModelMenu) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={loading}
          className={cn(
            `mr-1 flex items-center gap-1 text-xs text-muted-foreground`,
            !loading && 'hover:text-foreground'
          )}
        >
          <ContextSizeIndicator />
          {selectedModelConfig.displayName}

          <CaretDownIcon />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-80">
          {dropdownModels.map(([key, modelConfig]) => (
            <DropdownMenuCheckboxItem
              key={key}
              checked={othersModelKey === key}
              onCheckedChange={() => {
                setModel('others', key);
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
    );
  }

  const isOthers = modelType !== 'max';
  const radioGroupValue = isOthers ? othersModelKey : modelType;

  if (restrictedModel) {
    return null;
  }

  return (
    <DidYouKnowPopover
      open={false}
      setOpen={() => setKnowsAboutModelPicker(true)}
      title="AI model choices"
      description="Auto uses Claude Opus 4.6, or choose from other available models."
    >
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        {/* Needs a min-width or it shifts as the popover closes */}
        <PopoverTrigger
          className="group mr-1.5 flex h-7 min-w-24 items-center justify-end gap-1 rounded-full text-right hover:text-foreground focus-visible:outline focus-visible:outline-primary"
          onClick={(e) => {
            setKnowsAboutModelPicker(true);
            e.stopPropagation();
          }}
        >
          <ContextSizeIndicator />
          {isOthers ? selectedModelConfig.displayName : 'Auto'}
          <ArrowDropDownIcon className="group-[[aria-expanded=true]]:rotate-180" />
        </PopoverTrigger>

        <PopoverContent className="flex w-80 flex-col gap-2 p-0" id="ai-model-popover-content">
          <form>
            <RadioGroup
              value={radioGroupValue}
              className="flex flex-col gap-0"
              onValueChange={(value) => {
                // Check if the value is the recommended model type ('max')
                if (value === 'max') {
                  setModel(value, defaultOthersModelKey);
                } else {
                  // Otherwise set as an 'others' with the specific key
                  setModel('others', value as AIModelKey);
                }

                trackEvent('[AI].model.change', { model: value });
                setIsPopoverOpen(false);
              }}
            >
              <div className="flex flex-col rounded pt-2 text-sm">
                <RadioGroupLineItem
                  value="max"
                  label={MODEL_MODES_LABELS_DESCRIPTIONS.max.label}
                  description={MODEL_MODES_LABELS_DESCRIPTIONS.max.description}
                />
              </div>

              <hr className="my-2 border-border" />

              <RadioGroupHeader>
                Other AI models{' '}
                {!isOnPaidPlan && (
                  <span className="font-normal">
                    (exclusive to Pro,{' '}
                    <button
                      onClick={() => setShowUpgradeDialog({ open: true, eventSource: 'SelectAIModelMenu' })}
                      className="text-primary hover:underline"
                    >
                      upgrade now
                    </button>
                    )
                  </span>
                )}
              </RadioGroupHeader>

              <div className="flex flex-col rounded text-sm">
                {othersModels.map(([modelKey, modelConfig], i) => (
                  <RadioGroupLineItem
                    key={modelKey}
                    value={modelKey}
                    label={modelConfig.displayName}
                    description={modelConfig.displayProvider ?? 'C'}
                    disabled={!isOnPaidPlan}
                  />
                ))}
              </div>
            </RadioGroup>
          </form>
        </PopoverContent>
      </Popover>
    </DidYouKnowPopover>
  );
});

function RadioGroupHeader({ children }: { children: React.ReactNode }) {
  return <h5 className="mb-0 px-4 pb-2 pt-2 text-xs font-medium text-muted-foreground">{children}</h5>;
}

function RadioGroupLineItem({
  value,
  label,
  description,
  disabled,
}: {
  value: string;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <Label
      className={
        'flex cursor-pointer items-center px-4 py-3 has-[:disabled]:cursor-not-allowed has-[[aria-checked=true]]:bg-accent has-[:disabled]:text-muted-foreground'
      }
      key={value}
      htmlFor={`radio-${value}`}
    >
      <RadioGroupItem disabled={disabled} value={value} className="mr-2" id={`radio-${value}`} />
      <strong className="font-medium">{label}</strong>
      <span className="ml-auto font-normal text-muted-foreground">{description}</span>
    </Label>
  );
}
