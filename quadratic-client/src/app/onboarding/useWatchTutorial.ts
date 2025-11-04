import { claimBonusPromptAtom } from '@/app/atoms/bonusPromptsAtom';
import { calloutAtom } from '@/app/atoms/calloutAtom';
import { tutorialAtom } from '@/app/atoms/tutorialAtom';
import { events } from '@/app/events/events';
import { useSetAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';

const CATEGORY = 'watch-tutorial';
type State = undefined | 'menu-open' | 'video-open' | 'complete' | 'cancel';

const WATCH_TUTORIAL_ITEM_IDS = ['onboarding-checklist-item-watch-tutorial', 'onboarding-checklist-close'];

// Opens the Quadratic 101 video and claims the bonus prompt
export const useWatchTutorial = () => {
  const claimBonusPrompt = useSetAtom(claimBonusPromptAtom);
  const setTutorial = useSetAtom(tutorialAtom);
  const setCallout = useSetAtom(calloutAtom);

  const [state, setState] = useState<State>();
  const [repeat, setRepeat] = useState(false);

  useEffect(() => {
    switch (state) {
      case 'menu-open':
        setTutorial({ show: true, unmaskedElements: [...WATCH_TUTORIAL_ITEM_IDS, 'help-menubar-trigger'] });
        setCallout({ callouts: [{ id: 'help-menubar-trigger', side: 'right', text: 'Open help menu' }] });
        break;
      case 'video-open':
        setTutorial({ show: true, unmaskedElements: [...WATCH_TUTORIAL_ITEM_IDS, 'help-quadratic-101-trigger'] });
        setCallout({ callouts: [{ id: 'help-quadratic-101-trigger', side: 'right', text: 'Watch video' }] });
        break;
      case 'complete':
        setTutorial({ show: false, unmaskedElements: [] });
        setCallout({ callouts: [] });
        if (!repeat) {
          claimBonusPrompt(CATEGORY);
        }
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
      if (trigger === 'cancel') {
        setState('cancel');
      } else if (trigger === 'help-menubar-trigger') {
        setState('video-open');
      } else if (trigger === 'help-quadratic-101-trigger') {
        setState('complete');
      }
    };
    events.on('tutorialTrigger', handleTutorialTrigger);
    return () => {
      events.off('tutorialTrigger', handleTutorialTrigger);
    };
  }, [setTutorial]);

  return useCallback((repeat: boolean = false) => {
    setRepeat(repeat);
    setState('menu-open');
  }, []);
};
