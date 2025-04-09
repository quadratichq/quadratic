import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import mixpanel from 'mixpanel-browser';
import { memo } from 'react';
import { useRecoilValue } from 'recoil';

type ABTestProps = {
  name: string;
  control: React.ReactNode;
  variant: React.ReactNode;
  probability?: number; // Probability of getting the variant (default 0.1)
};

export const ABTest = memo(({ name, control, variant, probability = 0.1 }: ABTestProps) => {
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);

  // Convert the team's UUID to a number between 0 and 1
  // This is a simple hash function that will return a number between 0 and 1
  // This will allow us to split the users into two groups, control and variant
  // consistently putting the same user in the same group by using the same UUID
  const hash = parseInt(teamUuid.replace(/-/g, '').slice(0, 8), 16) / 0xffffffff;

  // Send to mixpanel
  mixpanel.track('[ABTest].started', {
    name,
    variant: hash < probability ? 'variant' : 'control',
    probability,
  });

  // Return variant if hash is less than probability, otherwise control
  return hash < probability ? variant : control;
});
