import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { aiAnalystCurrentChatUserMessagesCountAtom } from '@/app/atoms/aiAnalystAtom';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { DidYouKnowPopover } from '@/app/ui/components/DidYouKnowPopover';
import { apiClient } from '@/shared/api/apiClient';
import { AIIcon, ArrowDropDownIcon, LightbulbIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
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
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { CaretDownIcon } from '@radix-ui/react-icons';
import { DEFAULT_MODEL_FREE, DEFAULT_MODEL_PRO, MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelConfig, AIModelKey, ModelMode } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { useRecoilValue } from 'recoil';

const MODEL_MODES_LABELS_DESCRIPTIONS: Record<
  Exclude<ModelMode, 'disabled'>,
  { label: string; description: string }
> = {
  basic: { label: 'Fast', description: 'Good for everyday tasks' },
  pro: { label: 'Max', description: 'Smartest and most capable' },
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

  useEffect(() => {
    if (debug || isOnPaidPlan) {
      return;
    }

    if (selectedModelMode === 'pro') {
      setModelMode('basic');
    }
  }, [debug, isOnPaidPlan, selectedModelMode, setModelMode]);

  // "Did you know?" popover for the model picker
  // 1. Get the initial state from the server
  // 2. Save the initial state in local storage
  // 3. If the state changes from false to true, update localstorage and the server
  // We do it this way because the client state is not being synced with the
  // server state through the router.
  // So we keep track of it ourselves and then if the page is ever reloaded,
  // we'll get the freshest state.
  const {
    userMakingRequest: { clientDataKv },
  } = useFileRouteLoaderData();
  const initialKnowsAboutModelPicker = Boolean(clientDataKv?.knowsAboutModelPicker);
  const [knowsAboutModelPicker, setKnowsAboutModelPicker] = useLocalStorage(
    'knowsAboutModelPicker',
    initialKnowsAboutModelPicker
  );
  useEffect(() => {
    if (initialKnowsAboutModelPicker === false && knowsAboutModelPicker) {
      apiClient.user.clientDataKv.update({ knowsAboutModelPicker: true });
    }
  }, [initialKnowsAboutModelPicker, knowsAboutModelPicker]);
  const userMessagesCount = useRecoilValue(aiAnalystCurrentChatUserMessagesCountAtom);
  // If they've already seen the popover, don't show it.
  // Otherwise, only show it to them when they've used the AI a bit.
  const isOpenDidYouKnowDialog = knowsAboutModelPicker ? false : userMessagesCount > 4;

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
                  trackEvent('[AI].model.change', { model: modelConfig.model });
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
        <DidYouKnowPopover
          open={isOpenDidYouKnowDialog}
          setOpen={() => setKnowsAboutModelPicker(true)}
          title="AI model choices"
          description="Fast is our fastest model available. Max is slower but offers the most intelligence."
        >
          <Popover>
            {/* Needs a min-width or it shifts as the popover closes */}
            <PopoverTrigger
              className="group mr-1.5 flex h-7 min-w-24 items-center justify-end gap-0 rounded-full text-right hover:text-foreground focus-visible:outline focus-visible:outline-primary"
              onClick={() => {
                setKnowsAboutModelPicker(true);
              }}
            >
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
                        'flex cursor-pointer items-center px-4 py-3 has-[:disabled]:cursor-not-allowed has-[[aria-checked=true]]:bg-accent has-[:disabled]:text-muted-foreground',
                        i !== 0 && 'border-t border-border'
                      )}
                      key={mode}
                      onPointerDown={() => setModelMode(mode as ModelMode)}
                    >
                      <RadioGroupItem value={mode} className="mr-2" disabled={!isOnPaidPlan} />
                      <strong className="font-bold">{label}</strong>
                      <span className="ml-auto font-normal">{description}</span>
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
        </DidYouKnowPopover>
      ) : null}
    </>
  );
});
