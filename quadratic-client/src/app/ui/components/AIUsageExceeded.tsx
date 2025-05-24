import { Button } from '@/shared/shadcn/ui/button';
import mixpanel from 'mixpanel-browser';
import { memo } from 'react';

type AIUsageExceededProps = {
  show: boolean;
  delaySeconds?: number;
};

const divClassName =
  'mx-2 my-2 rounded-md border border-yellow-200 bg-yellow-50 px-2 py-1.5 text-xs font-medium dark:border-yellow-800 dark:bg-yellow-950/50';

export const AIUsageExceeded = memo(({ show, delaySeconds }: AIUsageExceededProps) => {
  if (!show || !delaySeconds) {
    return null;
  }

  return (
    <div className={divClassName}>
      Monthly AI free tier exceeded. <br></br>Upgrade to Quadratic Pro to continue using Quadratic AI.
      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            mixpanel.track('[AI].UsageExceeded.clickLearnMore', {
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
            mixpanel.track('[AI].UsageExceeded.clickUpgrade', {
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
