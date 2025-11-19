import { claimBonusPromptAtom } from '@/app/atoms/bonusPromptsAtom';
import { calloutAtom } from '@/app/atoms/calloutAtom';
import { editorInteractionStateShowShareFileMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { tutorialAtom } from '@/app/atoms/tutorialAtom';
import { events } from '@/app/events/events';
import { useSetAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

const CATEGORY = 'demo-connection';
type State = undefined | 'click-share' | 'enter-email' | 'complete' | 'cancel';

const SHARE_TUTORIAL_ITEM_IDS = ['onboarding-checklist-item-demo-connection', 'onboarding-checklist-close'];

export const useShareTutorial = () => {
  const showShareFileMenu = useRecoilValue(editorInteractionStateShowShareFileMenuAtom);
  const claimBonusPrompt = useSetAtom(claimBonusPromptAtom);
  const setTutorial = useSetAtom(tutorialAtom);
  const setCallout = useSetAtom(calloutAtom);

  const [state, setState] = useState<State>();
  const [repeat, setRepeat] = useState(false);

  useEffect(() => {
    switch (state) {
      case 'click-share':
        setTutorial({
          show: true,
          unmaskedElements: [...SHARE_TUTORIAL_ITEM_IDS, 'top-bar-share-button'],
        });
        setCallout({
          callouts: [{ id: 'top-bar-share-button', side: 'left', text: 'Click Share to invite someone' }],
        });
        break;
      case 'enter-email':
        // Wait for the dialog to be fully rendered before highlighting the input
        setTimeout(() => {
          setTutorial({
            show: true,
            unmaskedElements: [...SHARE_TUTORIAL_ITEM_IDS, 'share-file-email-input'],
          });
          setCallout({
            callouts: [
              {
                id: 'share-file-email-input',
                side: 'right',
                text: 'Enter an email address to share this file',
              },
            ],
          });
          // Focus and highlight the input
          const input = document.getElementById('share-file-email-input') as HTMLInputElement;
          if (input) {
            input.focus();
            // Add a highlight class temporarily
            input.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
            setTimeout(() => {
              input.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
            }, 2000);
          }
        }, 200);
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

  // Watch for share dialog opening
  useEffect(() => {
    if (state === 'click-share' && showShareFileMenu) {
      setState('enter-email');
    }
  }, [state, showShareFileMenu]);

  // Watch for email submission event
  useEffect(() => {
    if (state === 'enter-email') {
      const handleEmailSubmitted = () => {
        setState('complete');
      };
      events.on('shareFileEmailSubmitted', handleEmailSubmitted);
      return () => {
        events.off('shareFileEmailSubmitted', handleEmailSubmitted);
      };
    }
  }, [state]);

  useEffect(() => {
    const handleTutorialTrigger = (trigger: string) => {
      if (state) {
        if (trigger === 'cancel') {
          setState('cancel');
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
      // If share dialog is already open, go directly to enter-email state
      if (showShareFileMenu) {
        setState('enter-email');
      } else {
        setState('click-share');
      }
    },
    [showShareFileMenu]
  );
};
