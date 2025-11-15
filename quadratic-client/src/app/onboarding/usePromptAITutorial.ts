/* eslint-disable @typescript-eslint/no-unused-vars */
import { showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { claimBonusPromptAtom } from '@/app/atoms/bonusPromptsAtom';
import { calloutAtom } from '@/app/atoms/calloutAtom';
import { tutorialAtom } from '@/app/atoms/tutorialAtom';
import { events } from '@/app/events/events';
import { useSetAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

const CATEGORY = 'prompt-ai';
type State = undefined | 'open-ai' | 'add-prompt' | 'complete' | 'cancel';

const PROMPT_AI_TUTORIAL_ITEM_IDS = ['onboarding-checklist-item-prompt-ai', 'onboarding-checklist-close'];

export const usePromptAITutorial = () => {
  const showAIAnalyst = useRecoilValue(showAIAnalystAtom);
  const claimBonusPrompt = useSetAtom(claimBonusPromptAtom);
  const setTutorial = useSetAtom(tutorialAtom);
  const setCallout = useSetAtom(calloutAtom);

  const [state, setState] = useState<State>();
  const [repeat, setRepeat] = useState(false);

  useEffect(() => {
    switch (state) {
      case 'open-ai':
        setTutorial({ show: true, unmaskedElements: [...PROMPT_AI_TUTORIAL_ITEM_IDS, 'ai-analyst-trigger'] });
        setCallout({ callouts: [{ id: 'ai-analyst-trigger', side: 'right', text: 'Open AI chat' }] });
        break;
      case 'add-prompt':
        setTutorial({
          show: true,
          unmaskedElements: [...PROMPT_AI_TUTORIAL_ITEM_IDS, 'ai-analyst-user-message-form'],
        });
        setCallout({
          callouts: [
            { id: 'ai-analyst-user-message-form', side: 'right', text: 'Submit a prompt to try Quadratic AI' },
          ],
        });
        events.emit(
          'populateAIChatBox',
          'Help me build a chart in Quadratic. If there is no data on the sheet add sample data and plot it.'
        );
        break;
      case 'complete':
        setTutorial({ show: false, unmaskedElements: [] });
        setCallout({ callouts: [] });
        setState(undefined);
        if (!repeat) {
          claimBonusPrompt(CATEGORY);
        }
        events.emit('tutorialTrigger', 'complete');
        break;
      case 'cancel':
        setTutorial({ show: false, unmaskedElements: [] });
        setCallout({ callouts: [] });
        setState(undefined);
        break;
    }
  }, [claimBonusPrompt, repeat, setCallout, setTutorial, state]);

  useEffect(() => {
    const handleTutorialTrigger = (trigger: string) => {
      if (state) {
        if (trigger === 'cancel') {
          setState('cancel');
        } else if (trigger === 'ai-analyst-trigger') {
          setState('add-prompt');
        } else if (trigger === 'ai-analyst-submit-prompt') {
          setState('complete');
        }
      }
    };
    events.on('tutorialTrigger', handleTutorialTrigger);
    return () => {
      events.off('tutorialTrigger', handleTutorialTrigger);
    };
  }, [state]);

  return useCallback(
    (repeat: boolean = false) => {
      setRepeat(repeat);
      if (showAIAnalyst) {
        setState('add-prompt');
      } else {
        setState('open-ai');
      }
    },
    [showAIAnalyst]
  );
};
