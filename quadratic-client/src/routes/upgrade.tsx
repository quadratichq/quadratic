import { BillingPlans } from '@/dashboard/billing/BillingPlans';
import { apiClient } from '@/shared/api/apiClient';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { SpinnerIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { RocketIcon } from '@radix-ui/react-icons';
import { useCallback, useEffect, useState } from 'react';
import { redirect, useLoaderData, useNavigate, type LoaderFunctionArgs } from 'react-router';

// You're not supposed to navigate here directly, we will send you here.
// And we'll only send you here if you have the correct permissions.
//
// But if you do come here on your own (somehow?), that's ok as long if you have
// the right params. If you don't, we'll send you back to the dashboard.
//
// Example: `/upgrade?team=:uuid&redirect=:path`
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const teamUuid = searchParams.get('team');
  const redirectTo = searchParams.get('redirect') || '/';

  if (!teamUuid || !redirectTo) {
    console.warn('Required params missing. Redirecting to dashboard.');
    return redirect('/');
  }

  return { teamUuid, redirectTo };
};

export const Component = () => {
  const { teamUuid, redirectTo } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    trackEvent('[UpgradePage].loaded');
    apiClient.teams.update(teamUuid, { clientDataKv: { lastSolicitationForProUpgrade: new Date().toISOString() } });
  }, [teamUuid]);

  const handleUpgrade = useCallback(async () => {
    trackEvent('[UpgradePage].clickUpgrade');
    setIsLoading(true);
    apiClient.teams.billing.getCheckoutSessionUrl(teamUuid).then((data) => {
      window.location.href = data.url;
    });
  }, [teamUuid]);

  const handleNoThanks = useCallback(async () => {
    trackEvent('[UpgradePage].clickNoThanks');
    setIsLoading(true);
    navigate(redirectTo);
  }, [redirectTo, navigate]);

  return (
    <EmptyPage
      Icon={RocketIcon}
      title="Reminder: upgrade to Pro"
      description="A friendly, periodic reminder to upgrade your experience."
      className="w-full max-w-xl"
      actions={
        <div className="relative flex flex-col gap-8">
          <BillingPlans isOnPaidPlan={false} canManageBilling={true} teamUuid={teamUuid} />
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" className="w-36" onClick={handleNoThanks} disabled={isLoading}>
              No, thanks
            </Button>
            <Button className="relative w-36" onClick={handleUpgrade} disabled={isLoading}>
              Upgrade to Pro
            </Button>
          </div>
          {isLoading && (
            <div className="absolute top-full mt-4 flex w-full items-center justify-center">
              <SpinnerIcon className="text-primary" />
            </div>
          )}
        </div>
      }
    />
  );
};
