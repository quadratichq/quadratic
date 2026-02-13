import { CancellationDialog } from '@/components/CancellationDialog';
import { VITE_MAX_EDITABLE_FILES } from '@/env-vars';
import { showUpgradeDialogAtom } from '@/shared/atom/showUpgradeDialogAtom';
import { CheckIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useSetAtom } from 'jotai';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { BusinessPlan } from './BusinessPlan';

type BillingPlansProps = {
  isOnPaidPlan: boolean;
  canManageBilling: boolean;
  eventSource: string;
  teamUuid: string;
  planType?: 'FREE' | 'PRO' | 'BUSINESS';
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
    <div className={`${className} flex h-full flex-col`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Free plan</h3>
        {showCurrentPlanBadge && <Badge>Current plan</Badge>}
      </div>
      <div className="flex flex-grow flex-col gap-2 text-sm">
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

      <div className="mt-auto">{children}</div>
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
    <div className={`${className} flex h-full flex-col`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pro plan</h3>
        {showCurrentPlanBadge && <Badge>Current plan</Badge>}
      </div>
      <div className="flex flex-grow flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span>Team members</span>
          <span className="text-sm font-medium">$20/user/month</span>
        </div>
        <div className="flex items-center justify-between">
          <span>AI usage</span>
          <span className="text-sm font-medium">$20/user/month allowance</span>
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

      <div className="mt-auto">{children}</div>
    </div>
  );
};

export const BillingPlans = ({
  isOnPaidPlan,
  canManageBilling,
  eventSource,
  teamUuid,
  planType,
}: BillingPlansProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const setShowUpgradeDialog = useSetAtom(showUpgradeDialogAtom);

  // Get current path to return to after checkout
  const returnTo = location.pathname + location.search;

  const currentPlan = planType || (isOnPaidPlan ? 'PRO' : 'FREE');
  const isFree = currentPlan === 'FREE';
  const isPro = currentPlan === 'PRO';
  const isBusiness = currentPlan === 'BUSINESS';

  return (
    <div className="grid grid-cols-3 items-stretch gap-4">
      <FreePlan
        className={cn(
          'rounded p-4 outline outline-transparent',
          isFree ? 'border-2 border-primary bg-primary/5' : 'border border-border'
        )}
        showCurrentPlanBadge={isFree}
      >
        {(isPro || isBusiness) && (
          <CancellationDialog
            teamUuid={teamUuid}
            trigger={
              <Button
                disabled={!canManageBilling}
                variant="outline"
                className="mt-4 w-full"
                onClick={() => {
                  trackEvent('[Billing].downgradeToFreeClicked', { eventSource });
                }}
                data-testid="billing-downgrade-to-free-button"
              >
                Downgrade
              </Button>
            }
          />
        )}
        {!canManageBilling && (isPro || isBusiness) && (
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
      </FreePlan>

      {/* Pro */}
      <ProPlan
        className={cn(
          'rounded p-4 outline outline-transparent',
          isPro ? 'border-2 border-primary bg-primary/5' : 'border border-border'
        )}
        showCurrentPlanBadge={isPro}
      >
        {isFree ? (
          <Button
            disabled={!canManageBilling}
            onClick={() => {
              trackEvent('[Billing].upgradeToProClicked', { eventSource });
              navigate(ROUTES.TEAM_BILLING_SUBSCRIBE(teamUuid, { returnTo }));
            }}
            className="mt-4 w-full"
            data-testid="billing-upgrade-to-pro-button"
          >
            Upgrade to Pro
          </Button>
        ) : isPro ? (
          <div className="mt-4">
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
          </div>
        ) : (
          // Business plan - Pro is a lower tier, show downgrade button
          <div className="mt-4">
            <Button
              disabled={!canManageBilling}
              variant="outline"
              className="w-full"
              onClick={() => {
                trackEvent('[Billing].downgradeToProClicked', { eventSource });
                navigate(ROUTES.TEAM_BILLING_MANAGE(teamUuid));
              }}
              data-testid="billing-downgrade-to-pro-button"
            >
              Downgrade
            </Button>
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

      {/* Business */}
      <BusinessPlan
        className={cn(
          'rounded p-4 outline outline-transparent',
          isBusiness ? 'border-2 border-primary bg-primary/5' : 'border border-border'
        )}
        showCurrentPlanBadge={isBusiness}
      >
        {isFree || isPro ? (
          <Button
            disabled={!canManageBilling}
            onClick={() => {
              trackEvent('[Billing].upgradeToBusinessClicked', { eventSource });
              navigate(ROUTES.TEAM_BILLING_SUBSCRIBE(teamUuid, { returnTo, plan: 'business' }));
            }}
            className="mt-4 w-full"
            data-testid="billing-upgrade-to-business-button"
          >
            Upgrade to Business
          </Button>
        ) : (
          <div className="mt-4">
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
      </BusinessPlan>
    </div>
  );
};
