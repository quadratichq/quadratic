import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { memo } from 'react';
import { Link } from 'react-router';

export const AIUsageExceeded = memo(() => {
  const {
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();

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
          trackEvent('[AI].UsageExceeded.clickUpgrade', {
            ab_test: 'variant',
          });
        }}
        className="mt-2 w-full"
        asChild
      >
        <Link to={ROUTES.TEAM_SETTINGS(teamUuid)} reloadDocument>
          Upgrade to Pro
        </Link>
      </Button>
    </div>
  );
});
