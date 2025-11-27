import { claimBonusPromptAtom } from '@/app/atoms/bonusPromptsAtom';
import { calloutAtom } from '@/app/atoms/calloutAtom';
import { tutorialAtom } from '@/app/atoms/tutorialAtom';
import { events } from '@/app/events/events';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useSetAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';

const CATEGORY = 'watch-tutorial';
type State = undefined | 'menu-open' | 'complete' | 'cancel';

// const WATCH_TUTORIAL_ITEM_IDS = ['onboarding-checklist-item-watch-tutorial', 'onboarding-checklist-close'];

// Opens the Quadratic 101 video and claims the bonus prompt
export const useWatchTutorial = () => {
  const claimBonusPrompt = useSetAtom(claimBonusPromptAtom);
  const setTutorial = useSetAtom(tutorialAtom);
  const setCallout = useSetAtom(calloutAtom);

  const [state, setState] = useState<State>();
  const [repeat, setRepeat] = useState(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);

  useEffect(() => {
    switch (state) {
      case 'menu-open':
        setShowVideoDialog(true);
        break;
      case 'complete':
        setTutorial({ show: false, unmaskedElements: [] });
        setShowVideoDialog(false);
        trackEvent('[OnboardingChecklist].taskComplete', { id: CATEGORY });
        events.emit('tutorialTrigger', 'complete');
        if (!repeat) {
          claimBonusPrompt(CATEGORY);
        }
        break;
      case 'cancel':
        setTutorial({ show: false, unmaskedElements: [] });
        setShowVideoDialog(false);
        setState(undefined);
        break;
    }
  }, [claimBonusPrompt, repeat, setCallout, setTutorial, state]);

  useEffect(() => {
    const handleTutorialTrigger = (trigger: string) => {
      if (trigger === 'cancel') {
        setState('cancel');
      }
    };
    events.on('tutorialTrigger', handleTutorialTrigger);
    return () => {
      events.off('tutorialTrigger', handleTutorialTrigger);
    };
  }, [setTutorial]);

  const startTutorial = useCallback((repeat: boolean = false) => {
    setRepeat(repeat);
    setState('menu-open');
  }, []);

  const completeVideoDialog = useCallback(() => {
    setState('complete');
  }, []);

  const closeVideoDialog = useCallback(() => {
    setState('cancel');
  }, []);

  return { startTutorial, showVideoDialog, closeVideoDialog, completeVideoDialog };
};
