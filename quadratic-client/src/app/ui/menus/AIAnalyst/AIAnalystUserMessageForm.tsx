import { Action } from '@/app/actions/actions';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystCurrentChatUserMessagesCountAtom,
  aiAnalystLoadingAtom,
  aiAnalystPlanningModeEnabledAtom,
  aiAnalystWaitingOnMessageIndexAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import type { AIUserMessageFormWrapperProps, SubmitPromptArgs } from '@/app/ui/components/AIUserMessageForm';
import { AIUserMessageForm } from '@/app/ui/components/AIUserMessageForm';
import { ViewListIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { defaultAIAnalystContext } from '@/app/ui/menus/AIAnalyst/const/defaultAIAnalystContext';
import { useSubmitAIAnalystPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPrompt';
import { useSubmitAIAnalystPlanningPrompt } from '@/app/ui/menus/AIAnalyst/hooks/useSubmitAIAnalystPlanningPrompt';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isSupportedImageMimeType, isSupportedPdfMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import { forwardRef, memo, useCallback, useState } from 'react';
import { useRecoilCallback, useRecoilState, useRecoilValue } from 'recoil';

const ANALYST_FILE_TYPES = ['image/*', '.pdf'];

export const AIAnalystUserMessageForm = memo(
  forwardRef<HTMLTextAreaElement, AIUserMessageFormWrapperProps>((props: AIUserMessageFormWrapperProps, ref) => {
    const { initialContext, ...rest } = props;
    const abortController = useRecoilValue(aiAnalystAbortControllerAtom);
    const [loading, setLoading] = useRecoilState(aiAnalystLoadingAtom);
    const [context, setContext] = useState<Context>(initialContext ?? defaultAIAnalystContext);
    const userMessagesCount = useRecoilValue(aiAnalystCurrentChatUserMessagesCountAtom);
    const waitingOnMessageIndex = useRecoilValue(aiAnalystWaitingOnMessageIndexAtom);
    const [planningModeEnabled, setPlanningModeEnabled] = useRecoilState(aiAnalystPlanningModeEnabledAtom);
    const { submitPrompt } = useSubmitAIAnalystPrompt();
    const { submitPlanningPrompt } = useSubmitAIAnalystPlanningPrompt();

    const handleSubmit = useCallback(
      ({ content }: SubmitPromptArgs) => {
        trackEvent('[AIAnalyst].submitPrompt', { userMessageCountUponSubmit: userMessagesCount });

        if (planningModeEnabled) {
          // Use planning mode when enabled
          submitPlanningPrompt({
            messageSource: 'User',
            content,
            context,
            messageIndex: props.messageIndex,
          });
        } else {
          // Use regular submission
          submitPrompt({
            messageSource: 'User',
            content,
            context,
            messageIndex: props.messageIndex,
          });
        }
      },
      [context, props.messageIndex, submitPrompt, submitPlanningPrompt, userMessagesCount, planningModeEnabled]
    );

    const formOnKeyDown = useRecoilCallback(
      ({ set }) =>
        (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
          if (matchShortcut(Action.ToggleAIAnalyst, event)) {
            event.preventDefault();
            set(showAIAnalystAtom, (prev) => !prev);
          }
        },
      []
    );

    return (
      <>
        <AIUserMessageForm
          {...rest}
          ref={ref}
          abortController={abortController}
          loading={loading}
          setLoading={setLoading}
          isFileSupported={(mimeType) => isSupportedImageMimeType(mimeType) || isSupportedPdfMimeType(mimeType)}
          fileTypes={ANALYST_FILE_TYPES}
          submitPrompt={handleSubmit}
          formOnKeyDown={formOnKeyDown}
          ctx={{
            initialContext,
            context,
            setContext,
          }}
          waitingOnMessageIndex={waitingOnMessageIndex}
          maxHeight="275px"
        />
        {!rest.initialContent && (
          <div className="relative">
            {/* Planning Mode Toggle - positioned after the file attachment button */}
            <div className="absolute bottom-1 left-24 z-10">
              <TooltipPopover label={planningModeEnabled ? 'Disable planning mode' : 'Enable planning mode'}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPlanningModeEnabled(!planningModeEnabled)}
                  disabled={loading}
                  className={cn(
                    'h-7 rounded-md px-2 text-xs transition-colors',
                    planningModeEnabled
                      ? 'bg-primary/10 text-primary hover:bg-primary/20'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <ViewListIcon className="mr-1 h-3 w-3" />
                  Planning
                </Button>
              </TooltipPopover>
            </div>
          </div>
        )}
      </>
    );
  })
);
