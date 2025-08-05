import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { AIIcon, ArrowDropDownIcon, LightbulbIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
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
import { CaretDownIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { DEFAULT_MODEL_FREE, DEFAULT_MODEL_PRO, MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelConfig, AIModelKey, ModelMode } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useMemo } from 'react';
import { Link } from 'react-router';

const MODEL_MODES_LABELS_DESCRIPTIONS: Record<
  Exclude<ModelMode, 'disabled'>,
  { label: string; description: string }
> = {
  basic: { label: 'Basic', description: 'good for everyday tasks' },
  pro: { label: 'Pro', description: 'smartest and most capable' },
};

interface SelectAIModelMenuProps {
  loading: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}
export const SelectAIModelMenu = memo(({ loading, textareaRef }: SelectAIModelMenuProps) => {
  const { debug } = useDebugFlags();

  const {
    isOnPaidPlan,
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
    return debug ? configs : configs.filter(([_, config]) => config.mode !== 'disabled');
  }, [debug]);

  const dropdownModels = useMemo(
    () =>
      modelConfigs
        .filter(
          ([, modelConfig]) =>
            modelConfig.thinkingToggle === undefined ||
            (selectedModelConfig.thinkingToggle === undefined && modelConfig.thinkingToggle === thinkingToggle) ||
            selectedModelConfig.thinkingToggle === modelConfig.thinkingToggle
        )
        .sort(([, a], [, b]) => (a.mode !== 'disabled' ? 1 : -1) + (b.mode !== 'disabled' ? -1 : 1)),
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

  const selectedModelMode = useMemo(
    () => (selectedModelConfig.mode === 'disabled' ? 'pro' : selectedModelConfig.mode),
    [selectedModelConfig.mode]
  );
  const setModelMode = useCallback(
    (mode: ModelMode) => {
      const nextModel = modelConfigs.find(
        ([_, modelConfig]) =>
          modelConfig.mode === mode &&
          (modelConfig.thinkingToggle === undefined || modelConfig.thinkingToggle === thinkingToggle)
      );

      if (nextModel) {
        setSelectedModel(nextModel[0]);
      }
    },
    [modelConfigs, setSelectedModel, thinkingToggle]
  );
  const selectedModelLabel = useMemo(
    () => MODEL_MODES_LABELS_DESCRIPTIONS[selectedModelMode].label,
    [selectedModelMode]
  );

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

      {debug ? (
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
                  mixpanel.track('[AI].model.change', { model: modelConfig.model });
                  setSelectedModel(key);
                }}
              >
                <div className="flex w-full items-center justify-between text-xs">
                  <span className="pr-4">
                    {(debug ? `${modelConfig.mode === 'disabled' ? '(debug) ' : ''}${modelConfig.provider} - ` : '') +
                      modelConfig.displayName}
                  </span>
                </div>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : DEFAULT_MODEL_FREE !== DEFAULT_MODEL_PRO ? (
        <Popover>
          {/* Needs a min-width or it shifts as the popover closes */}
          <PopoverTrigger className="group mr-1.5 flex min-w-24 items-center justify-end gap-0 text-right">
            Model: {selectedModelLabel}
            <ArrowDropDownIcon className="group-[[aria-expanded=true]]:rotate-180" />
          </PopoverTrigger>

          <PopoverContent className="flex w-80 flex-col gap-2">
            <div className="mt-2 flex flex-col items-center">
              <AIIcon className="mb-2 text-primary" size="lg" />

              <h4 className="text-lg font-semibold">AI models</h4>

              <p className="text-sm text-muted-foreground">Choose the best fit for your needs.</p>
            </div>

            <form className="flex flex-col gap-1 rounded border border-border text-sm">
              <RadioGroup value={selectedModelMode} className="flex flex-col gap-0">
                {Object.entries(MODEL_MODES_LABELS_DESCRIPTIONS).map(([mode, { label, description }], i) => (
                  <Label
                    className={cn(
                      'cursor-pointer px-4 py-3 has-[:disabled]:cursor-not-allowed has-[[aria-checked=true]]:bg-accent has-[:disabled]:text-muted-foreground',
                      i !== 0 && 'border-t border-border'
                    )}
                    key={mode}
                    onPointerDown={() => setModelMode(mode as ModelMode)}
                  >
                    <strong className="font-bold">{label}</strong>: <span className="font-normal">{description}</span>
                    <RadioGroupItem value={mode} className="float-right ml-auto" disabled={!isOnPaidPlan} />
                  </Label>
                ))}
              </RadioGroup>
            </form>

            {!isOnPaidPlan && (
              <Button variant="link" asChild>
                <Link to={ROUTES.ACTIVE_TEAM_SETTINGS} target="_blank">
                  Upgrade now for access to Pro
                </Link>
              </Button>
            )}
          </PopoverContent>
        </Popover>
      ) : null}
    </>
  );
});
