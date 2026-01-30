import { CancellationDialog } from '@/components/CancellationDialog';
import { VITE_MAX_EDITABLE_FILES } from '@/env-vars';
import { showUpgradeDialogAtom } from '@/shared/atom/showUpgradeDialogAtom';
import { CheckIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/shadcn/ui/dialog';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useSetAtom } from 'jotai';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

type BillingPlansProps = {
  isOnPaidPlan: boolean;
  canManageBilling: boolean;
  eventSource: string;
  teamUuid: string;
};

export const FreePlan = ({
  className,
  showCurrentPlanBadge,
  children,
}: {
  children?: ReactNode;
  className?: string;
  showCurrentPlanBadge?: boolean;
}) => {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Free plan</h3>
        {showCurrentPlanBadge && <Badge>Current plan</Badge>}
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span>Team members</span>
          <span className="font-medium">Limited</span>
        </div>
        <div className="flex items-center justify-between">
          <span>AI messages</span>
          <span className="font-medium">5/month</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Connections</span>
          <span className="font-medium">Limited</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Files</span>
          <span className="font-medium">{VITE_MAX_EDITABLE_FILES} editable files</span>
        </div>
      </div>

      {children}
    </div>
  );
};

export const ProPlan = ({
  children,
  showCurrentPlanBadge,
  className,
}: {
  className?: string;
  children?: ReactNode;
  showCurrentPlanBadge?: boolean;
}) => {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pro plan</h3>
        {showCurrentPlanBadge && <Badge>Current plan</Badge>}
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span>Team members</span>
          <span className="text-sm font-medium">$20/user/month</span>
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
                    We currently don’t charge for AI usage on the Pro plan. We reserve the right to limit unreasonable
                    use and abuse.
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
          <span>Files</span>
          <span className="text-right text-sm font-medium">Unlimited</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Additional AI models</span>
          <span className="flex items-center">
            <CheckIcon />
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Additional privacy controls</span>
          <span className="flex items-center">
            <CheckIcon />
          </span>
        </div>
      </div>

      {children}
    </div>
  );
};

export const BillingPlans = ({ isOnPaidPlan, canManageBilling, eventSource, teamUuid }: BillingPlansProps) => {
  const navigate = useNavigate();
  const setShowUpgradeDialog = useSetAtom(showUpgradeDialogAtom);
  const className = 'rounded border border-border p-4 outline outline-transparent';

  return (
    <div className="grid grid-cols-2 gap-4">
      <FreePlan className={className} showCurrentPlanBadge={!isOnPaidPlan} />

      {/* Pro */}
      <ProPlan className={className} showCurrentPlanBadge={isOnPaidPlan}>
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
            Only the team owner can edit billing info.
            <br />
            <Link
              to={ROUTES.TEAM_MEMBERS(teamUuid)}
              className="underline"
              onClick={() => setShowUpgradeDialog({ open: false, eventSource: null })}
            >
              View team members
            </Link>
          </p>
        )}
      </ProPlan>
    </div>
  );
};
