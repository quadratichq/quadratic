import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { memo } from 'react';

type AIUsageExceededProps = {
  show: boolean;
};

const divClassName =
  'mx-2 my-2 rounded-md border border-yellow-200 bg-yellow-50 px-2 py-1.5 text-xs font-medium dark:border-yellow-800 dark:bg-yellow-950/50';

export const AIUsageExceeded = memo(({ show }: AIUsageExceededProps) => {
  if (!show) {
    return null;
  }

  return (
    <div className={divClassName}>
      Monthly AI free tier exceeded. <br></br>Upgrade to Quadratic Pro to continue using Quadratic AI.
      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            trackEvent('[AI].UsageExceeded.clickLearnMore', {
              ab_test: 'variant',
            });
            // go to the team settings page in a new tab
            window.open('/team/settings', '_blank');
          }}
          className="flex-1"
        >
          Learn more
        </Button>
        <Button
          onClick={() => {
            trackEvent('[AI].UsageExceeded.clickUpgrade', {
              ab_test: 'variant',
            });
            // navigate to the team settings page
            window.open('/team/settings', '_blank');
          }}
          className="flex-1"
        >
          Upgrade to Pro
        </Button>
      </div>
    </div>
  );
});
