import { CancellationDialog } from '@/components/CancellationDialog';
import { CheckIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/shadcn/ui/dialog';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { Link } from 'react-router';

type BillingPlansProps = {
  isOnPaidPlan: boolean;
  canManageBilling: boolean;
  teamUuid: string;
};

export const BillingPlans = ({ isOnPaidPlan, canManageBilling, teamUuid }: BillingPlansProps) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Free */}
      <div className={cn('rounded border border-border p-4 outline outline-transparent')}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Free plan</h3>
          {!isOnPaidPlan && <Badge>Current plan</Badge>}
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Team members</span>
            <span className="font-medium">Limited</span>
          </div>
          <div className="flex items-center justify-between">
            <span>AI messages</span>
            <span className="font-medium">Limited</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Connections</span>
            <span className="font-medium">Limited</span>
          </div>
        </div>
      </div>

      {/* Pro */}
      <div className={cn('rounded border p-4 outline', 'border-foreground shadow-md outline outline-foreground/10')}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Pro plan</h3>
          {isOnPaidPlan && <Badge>Current plan</Badge>}
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Team members</span>
            <span className="text-sm font-medium">
              $20 <span className="text-xs text-muted-foreground">/user/month</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">AI messages</span>
            <div className="flex items-center gap-1">
              <span className="flex items-center gap-1 text-sm font-medium">
                <Dialog>
                  <DialogTrigger className="border-b border-dashed border-border hover:border-foreground">
                    * Unlimited
                  </DialogTrigger>
                  <DialogContent aria-describedby={undefined}>
                    <DialogHeader>
                      <DialogTitle>AI message limits</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                      We don't impose a strict limit on AI usage on the Pro plan. We reserve the right to limit
                      unreasonable use and abuse.
                    </p>
                  </DialogContent>
                </Dialog>
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>Connections</span>
            <span className="text-right text-sm font-medium">Unlimited</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Additional AI models</span>
            <span className="font-medium">
              <CheckIcon />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Additional privacy controls</span>
            <span className="font-medium">
              <CheckIcon />
            </span>
          </div>
        </div>

        {!isOnPaidPlan ? (
          <Button
            disabled={!canManageBilling}
            onClick={() => {
              // TODO: event source prop for tracking
              trackEvent('[TeamSettings].upgradeToProClicked', {
                team_uuid: teamUuid,
              });
            }}
            className="mt-4 w-full"
            asChild
          >
            <Link to={`TODO: ROUTES.TEAM_BILLING(teamUuid)`}>Upgrade to Pro</Link>
          </Button>
        ) : (
          <div className="mt-4 space-y-2">
            <Button
              disabled={!canManageBilling}
              variant="outline"
              className="w-full"
              onClick={() => {
                trackEvent('[TeamSettings].manageBillingClicked', {
                  team_uuid: teamUuid,
                });
              }}
              asChild
            >
              <Link to={'/TODO:ROUTES.TEAM_BILLING(teamUuid)'}>Manage subscription</Link>
            </Button>
            {canManageBilling && <CancellationDialog teamUuid={teamUuid} />}
          </div>
        )}
        {!canManageBilling && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Only{' '}
            <Link to={ROUTES.TEAM_MEMBERS(teamUuid)} className="underline">
              the team owner
            </Link>{' '}
            can edit billing info.
          </p>
        )}
      </div>
    </div>
  );
};

/*

TODO: Conditionally pass these in, because we may not actually want them in every context  
          {!isOnPaidPlan ? (
            <Button
              disabled={!canManageBilling}
              onClick={() => {
                trackEvent('[TeamSettings].upgradeToProClicked', {
                  team_uuid: team.uuid,
                });
                apiClient.teams.billing.getCheckoutSessionUrl(team.uuid).then((data) => {
                  window.location.href = data.url;
                });
              }}
              className="mt-4 w-full"
            >
              Upgrade to Pro
            </Button>
          ) : (
            <div className="mt-4 space-y-2">
              
              <Button
                disabled={!canManageBilling}
                variant="outline"
                className="w-full"
                onClick={() => {
                  trackEvent('[TeamSettings].manageBillingClicked', {
                    team_uuid: team.uuid,
                  });
                  handleNavigateToStripePortal();
                }}
              >
                Manage subscription
              </Button>
              {canManageBilling && (
                <CancellationDialog teamUuid={team.uuid} handleNavigateToStripePortal={handleNavigateToStripePortal} />
              )}
            </div>
          )}
          {!canManageBilling && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              You cannot edit billing details. Contact{' '}
              <Link to={ROUTES.TEAM_MEMBERS(team.uuid)} className="underline">
                your team owner
              </Link>
              .
            </p>
          )} 


*/
