import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import mixpanel from 'mixpanel-browser';
import { memo } from 'react';

type ABTestProps = {
  name: string;
  control: React.ReactNode;
  variant: React.ReactNode;
  probability?: number; // Probability of getting the variant (default 0.1)
};

export const ABTest = memo(({ name, control, variant, probability = 0.1 }: ABTestProps) => {
  const { team } = useFileRouteLoaderData();

  // Convert the team's UUID to a number between 0 and 1
  // This is a simple hash function that will return a number between 0 and 1
  // This will allow us to split the users into two groups, control and variant
  // consistently puting the same user in the same group by using the same UUID
  const hash = parseInt(team.uuid.replace(/-/g, '').slice(0, 8), 16) / 0xffffffff;

  // Send to mixpanel
  mixpanel.track('[ABTest].started', {
    name,
    variant: hash < probability ? 'variant' : 'control',
    probability,
  });

  // Return variant if hash is less than probability, otherwise control
  return hash < probability ? variant : control;
});
