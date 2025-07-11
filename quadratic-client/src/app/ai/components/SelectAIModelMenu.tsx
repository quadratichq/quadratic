import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { aiAnalystChatsAtom } from '@/app/atoms/aiAnalystAtom';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { DidYouKnowPopover } from '@/app/ui/components/DidYouKnowPopover';
import { useIsOnPaidPlan } from '@/app/ui/hooks/useIsOnPaidPlan';
import { AIIcon, ArrowDropDownIcon, LightbulbIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
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
import { CaretDownIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelConfig, AIModelKey, ChatMessage, ModelMode } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useRecoilValue } from 'recoil';

const HAS_CLICKED_MODEL_PICKER_KEY = 'hasClickedModelPicker';

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
  const [, setHasClickedModelPicker] = useLocalStorage(HAS_CLICKED_MODEL_PICKER_KEY, false);

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

  const { isOnPaidPlan } = useIsOnPaidPlan();
  useEffect(() => {
    if (debug || isOnPaidPlan) {
      return;
    }

    if (selectedModelMode === 'pro') {
      setModelMode('basic');
    }
  }, [debug, isOnPaidPlan, selectedModelMode, setModelMode]);

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
      ) : (
        <DidYouKnow>
          <Popover>
            {/* Needs a min-width or it shifts as the popover closes */}
            <PopoverTrigger
              className="group mr-1.5 flex h-7 min-w-24 items-center justify-end gap-0 rounded-full text-right hover:text-foreground focus-visible:outline focus-visible:outline-primary"
              onClick={() => {
                setHasClickedModelPicker(true);
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
        </DidYouKnow>
      )}
    </>
  );
});

function DidYouKnow({ children }: { children: React.ReactNode }) {
  // TODO: differentiate between whether this is an AI analyst or AI assistant

  const [hasClickedModelPicker] = useLocalStorage(HAS_CLICKED_MODEL_PICKER_KEY, false);
  const [hasSeenProModelPopover, setHasSeenProModelPopover] = useLocalStorage('hasSeenProModelPopover', false);
  const chats = useRecoilValue(aiAnalystChatsAtom);
  console.log('chats', chats);

  // Determine whether to show
  const initialOpen = useMemo(() => {
    // Have they ever clicked on the model picker? If so, don't show it because
    // we can assume they know about the feature.
    if (hasClickedModelPicker) {
      console.log('hasClickedModelPicker');
      // return false;
    }

    // Have they ever seen this popover? If so, don't show it.
    if (hasSeenProModelPopover) {
      console.log('hasSeenProModelPopover');
      // return false;
    }

    // Have they prompted the AI less than 5 times? If yes, don't show it
    // (make sure they've used the AI a bit before showing)
    const userMessages: ChatMessage[] = [];
    for (const chat of chats) {
      const messages = chat.messages.filter(
        (message) => message.role === 'user' && message.contextType === 'userPrompt'
      );
      userMessages.push(...messages);
    }
    console.log('userMessages', userMessages);
    if (userMessages.length < 2) {
      console.log('userMessages.length < 5', userMessages.length);
      // return false;
    }

    // Are there any "pro" models used in their chat history? If yes, don't show it
    // (this weeds out people who've been using the app already and have used the model picker).
    let hasUsedProModel = false;
    outer: for (const chat of chats) {
      for (const message of chat.messages) {
        // TODO: fix this part
        // TODO: turn console.log statements into debug flags
        if (message.role === 'assistant' && message.contextType === 'userPrompt' && message.modelKey.includes('-pro')) {
          hasUsedProModel = true;
          break outer;
        }
      }
    }
    if (hasUsedProModel) {
      console.log('hasUsedProModel');
      // return false;
    }

    // If none of the above prevented this from being shown, show it.
    return true;
  }, [chats, hasClickedModelPicker, hasSeenProModelPopover]);

  // Set the initial state
  const [open, setOpen] = useState(initialOpen);

  // When this thing is seen, save that state
  useEffect(() => {
    if (open && !hasSeenProModelPopover) {
      setHasSeenProModelPopover(true);
    }
  }, [open, hasSeenProModelPopover, setHasSeenProModelPopover]);

  return (
    <DidYouKnowPopover
      open={open}
      setOpen={setOpen}
      title="Try our Pro model"
      description="Pro is our best and most capable model. But be careful, it uses credits more quickly."
    >
      {children}
    </DidYouKnowPopover>
  );
}
