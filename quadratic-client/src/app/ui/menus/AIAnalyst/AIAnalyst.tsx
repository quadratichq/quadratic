import {
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystPlanningModeAtom,
  aiAnalystPlanningModeEnabledAtom,
  aiAnalystShowChatHistoryAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { presentationModeAtom } from '@/app/atoms/gridSettingsAtom';
import { AIUserMessageFormDisclaimer } from '@/app/ui/components/AIUserMessageFormDisclaimer';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { AIAnalystChatHistory } from '@/app/ui/menus/AIAnalyst/AIAnalystChatHistory';
import { AIAnalystGetChatName } from '@/app/ui/menus/AIAnalyst/AIAnalystGetChatName';
import { AIAnalystHeader } from '@/app/ui/menus/AIAnalyst/AIAnalystHeader';
import { AIAnalystMessages } from '@/app/ui/menus/AIAnalyst/AIAnalystMessages';
import { AIAnalystUserMessageForm } from '@/app/ui/menus/AIAnalyst/AIAnalystUserMessageForm';
import { AIPlanningInterface } from '@/app/ui/menus/AIAnalyst/AIPlanningInterface';
import { useAIAnalystPanelWidth } from '@/app/ui/menus/AIAnalyst/hooks/useAIAnalystPanelWidth';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { cn } from '@/shared/shadcn/utils';
import { memo, useCallback, useEffect, useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';

export const AIAnalyst = memo(() => {
  const showAIAnalyst = useRecoilValue(showAIAnalystAtom);
  const presentationMode = useRecoilValue(presentationModeAtom);
  const showChatHistory = useRecoilValue(aiAnalystShowChatHistoryAtom);
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
  const planningModeEnabled = useRecoilValue(aiAnalystPlanningModeEnabledAtom);
  const planningMode = useRecoilValue(aiAnalystPlanningModeAtom);
  const setPlanningMode = useSetRecoilState(aiAnalystPlanningModeAtom);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { panelWidth, setPanelWidth } = useAIAnalystPanelWidth();
  const { submitPrompt } = useSubmitAIAnalystPrompt();

  const initialLoadRef = useRef(true);
  const autoFocusRef = useRef(false);
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
    } else {
      autoFocusRef.current = true;
    }
  }, [showAIAnalyst]);

  const handleResize = useCallback(
    (event: MouseEvent) => {
      const panel = aiPanelRef.current;
      if (!panel) return;
      event.stopPropagation();
      event.preventDefault();

      const containerRect = panel.getBoundingClientRect();
      const newPanelWidth = event.x - (containerRect.left - 2);
      setPanelWidth(newPanelWidth);
    },
    [setPanelWidth]
  );

  const handleExecutePlan = useCallback((plan: string) => {
    // Submit the plan as a regular AI prompt for execution
    const planContent = [
      createTextContent(`Please execute this plan:\n\n${plan}\n\nOriginal request: ${planningMode.originalQuery}`)
    ];
    
    submitPrompt({
      messageSource: 'User',
      content: planContent,
      context: defaultAIAnalystContext,
      messageIndex: messagesCount,
    });

    // Clear planning mode
    setPlanningMode(prev => ({
      ...prev,
      currentPlan: '',
      planSteps: [],
      planEdited: false,
      loading: false,
      originalQuery: '',
    }));
  }, [setPlanningMode, planningMode.originalQuery, submitPrompt, messagesCount]);

  const handleCancelPlan = useCallback(() => {
    setPlanningMode(prev => ({
      ...prev,
      currentPlan: '',
      planSteps: [],
      planEdited: false,
      loading: false,
      originalQuery: '',
    }));
  }, [setPlanningMode]);

  const showPlanningInterface = planningModeEnabled && (planningMode.currentPlan || planningMode.loading);

  if (!showAIAnalyst || presentationMode) {
    return null;
  }

  return (
    <>
      <AIAnalystGetChatName />

      <div
        ref={aiPanelRef}
        className="relative hidden h-full shrink-0 overflow-hidden md:block"
        style={{ width: `${panelWidth}px` }}
        onCopy={(e) => e.stopPropagation()}
        onCut={(e) => e.stopPropagation()}
        onPaste={(e) => e.stopPropagation()}
      >
        <ResizeControl position="VERTICAL" style={{ left: `${panelWidth - 2}px` }} setState={handleResize} />

        <div
          className={cn(
            'h-full w-full',
            showChatHistory ? 'grid grid-rows-[auto_1fr]' : 'grid grid-rows-[auto_1fr_auto]'
          )}
        >
          <AIAnalystHeader textareaRef={textareaRef} />

          {showChatHistory ? (
            <AIAnalystChatHistory />
          ) : showPlanningInterface ? (
            <AIPlanningInterface
              onExecutePlan={handleExecutePlan}
              onCancel={handleCancelPlan}
            />
          ) : (
            <>
              <AIAnalystMessages textareaRef={textareaRef} />

              <div className="px-2 py-0.5">
                <AIAnalystUserMessageForm
                  ref={textareaRef}
                  autoFocusRef={autoFocusRef}
                  textareaRef={textareaRef}
                  messageIndex={messagesCount}
                />
                <AIUserMessageFormDisclaimer />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
});
