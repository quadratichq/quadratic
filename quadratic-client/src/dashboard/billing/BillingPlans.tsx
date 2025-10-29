import { CancellationDialog } from '@/components/CancellationDialog';
import { CheckIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/shadcn/ui/dialog';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { Link, useNavigate } from 'react-router';

type BillingPlansProps = {
  isOnPaidPlan: boolean;
  canManageBilling: boolean;
  eventSource: string;
  teamUuid: string;
};

export const BillingPlans = ({ isOnPaidPlan, canManageBilling, eventSource, teamUuid }: BillingPlansProps) => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Free */}
      <div className={cn('rounded border border-border p-4 outline outline-transparent')}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Free plan</h3>
          {!isOnPaidPlan && <Badge>Current plan</Badge>}
        </div>
        <div className="flex flex-col gap-2 text-sm">
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
          <div className="flex items-center justify-between">
            <span>Maximum files</span>
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
        <div className="flex flex-col gap-2 text-sm">
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
            <span>Maximum files</span>
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
              trackEvent('[Billing].upgradeToProClicked', { eventSource });
              navigate(ROUTES.TEAM_BILLING_SUBSCRIBE(teamUuid));
            }}
            className="mt-4 w-full"
            data-testid="billing-upgrade-to-pro-button"
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
                trackEvent('[Billing].manageBillingClicked', { eventSource });
                navigate(ROUTES.TEAM_BILLING_MANAGE(teamUuid));
              }}
            >
              Manage subscription
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
