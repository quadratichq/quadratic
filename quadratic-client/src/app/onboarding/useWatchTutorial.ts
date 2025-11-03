import { claimBonusPromptAtom } from '@/app/atoms/bonusPromptsAtom';
import { openLink } from '@/app/helpers/links';
import { useSetAtom } from 'jotai';
import { useCallback } from 'react';

const CATEGORY = 'watch-tutorial';

// Opens the Quadratic 101 video and claims the bonus prompt
export const useWatchTutorial = () => {
  const claimBonusPrompt = useSetAtom(claimBonusPromptAtom);

  return useCallback(
    (repeat: boolean = false) => {
      openLink('https://www.quadratichq.com/quadratic-101');
      if (!repeat) {
        claimBonusPrompt(CATEGORY);
      }
    },
    [claimBonusPrompt]
  );
};
