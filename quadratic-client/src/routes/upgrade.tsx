import { apiClient } from '@/shared/api/apiClient';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { RocketIcon } from '@radix-ui/react-icons';
import { redirect, useLoaderData, useNavigate, type LoaderFunctionArgs } from 'react-router';

// You're not supposed to navigate here directly, we will send you here.
// But if you do that's ok, as long as you have the right params.
//
// Example: `/upgrade?team=:uuid&redirect=:path`
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const teamUuid = searchParams.get('team');
  const redirectTo = searchParams.get('redirect') || '/';

  if (!teamUuid) {
    console.warn('No team to upgrade. Redirecting to dashboard.');
    return redirect('/');
  }

  return { teamUuid, redirectTo };
};

export const Component = () => {
  const { teamUuid, redirectTo } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const handleUpgrade = async () => {
    trackEvent('[UpgradePage].clickUpgrade');
    apiClient.teams.billing.getCheckoutSessionUrl(teamUuid).then((data) => {
      window.location.href = data.url;
    });
  };

  const handleNoThanks = async () => {
    trackEvent('[UpgradePage].clickNoThanks');
    navigate(redirectTo);
  };

  return (
    <EmptyPage
      Icon={RocketIcon}
      title="Reminder: upgrade to Pro"
      description="A friendly, periodic reminder to upgrade your experience."
      actions={
        <div className="flex flex-col gap-2">
          <div className="mb-6 flex h-28 items-center justify-center rounded-lg bg-border">Free vs. pro here</div>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" className="w-36" onClick={handleNoThanks}>
              No, thanks
            </Button>
            <Button className="w-36" onClick={handleUpgrade}>
              Upgrade to Pro
            </Button>
          </div>
        </div>
      }
    />
  );

  // return (
  //   <div className="flex h-full w-full flex-col items-center justify-center gap-2">
  //     <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-lg border border-border">
  //       <RocketLaunchIcon size="lg" className="text-primary" />
  //     </div>
  //     <h1 className="text-3xl font-bold">Reminder: upgrade to Pro</h1>
  //     <p className="text-base text-muted-foreground">A friendly, periodic reminder to upgrade your experience.</p>
  //     <div className="mt-2 flex items-center gap-2">
  //       <Button variant="outline" className="w-36">
  //         No, thanks
  //       </Button>
  //       <Button className="w-36">Upgrade to Pro</Button>
  //     </div>
  //   </div>
  // );
};
