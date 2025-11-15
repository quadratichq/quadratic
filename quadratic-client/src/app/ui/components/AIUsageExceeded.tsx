import { showUpgradeDialogAtom } from '@/shared/atom/showUpgradeDialogAtom';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useSetAtom } from 'jotai';
import { memo } from 'react';

export const AIUsageExceeded = memo(() => {
  const setShowUpgradeDialog = useSetAtom(showUpgradeDialogAtom);

  return (
    <div
      className={
        'mx-2 my-2 rounded-md border border-yellow-200 bg-yellow-50 p-2 text-center text-sm dark:border-yellow-800 dark:bg-yellow-950/50'
      }
    >
      <h3 className="font-semibold">Monthly AI free tier exceeded</h3>
      <p className="text-muted-foreground">Upgrade to a Pro plan to continue using Quadratic AI.</p>

      <Button
        onClick={() => {
          setShowUpgradeDialog({ open: true, eventSource: 'AIUsageExceeded' });
          trackEvent('[AI].UsageExceeded.clickUpgrade');
        }}
        className="mt-2 w-full"
        size="sm"
      >
        Upgrade to Pro
      </Button>
    </div>
  );
});
