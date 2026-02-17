import { CancellationDialog } from '@/components/CancellationDialog';
import { apiClient } from '@/shared/api/apiClient';
import { billingConfigAtom, fetchBillingConfig } from '@/shared/atom/billingConfigAtom';
import { showUpgradeDialogAtom } from '@/shared/atom/showUpgradeDialogAtom';
import { teamBillingAtom, updateTeamBilling } from '@/shared/atom/teamBillingAtom';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useNavigation } from 'react-router';
import { BusinessPlan } from './BusinessPlan';
import { FreePlan } from './FreePlan';
import { ProPlan } from './ProPlan';

type BillingPlansProps = {
  canManageBilling: boolean;
  eventSource: string;
  teamUuid: string;
};

export const BillingPlans = ({ canManageBilling, eventSource, teamUuid }: BillingPlansProps) => {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const location = useLocation();
  const setShowUpgradeDialog = useSetAtom(showUpgradeDialogAtom);
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const { planType } = useAtomValue(teamBillingAtom);
  const billingConfig = useAtomValue(billingConfigAtom);
  const isNavigating = navigation.state !== 'idle';
  const [isUpgradingToBusiness, setIsUpgradingToBusiness] = useState(false);
  const [isUpgradingToPro, setIsUpgradingToPro] = useState(false);
  const isBusy = isNavigating || isUpgradingToBusiness;

  useEffect(() => {
    fetchBillingConfig();
  }, []);

  // Get current path to return to after checkout
  const returnTo = location.pathname + location.search;

  const isFree = planType === 'FREE';
  const isPro = planType === 'PRO';
  const isBusiness = planType === 'BUSINESS';

  const handleUpgradeToBusiness = async () => {
    trackEvent('[Billing].upgradeToBusinessClicked', { eventSource });

    if (isPro) {
      // Pro→Business: the API handles this synchronously (no Stripe checkout page),
      // so we call the API directly and update the UI inline.
      setIsUpgradingToBusiness(true);
      try {
        const redirectUrl = `${window.location.origin}${returnTo}`;
        await apiClient.teams.billing.getCheckoutSessionUrl(teamUuid, redirectUrl, redirectUrl, 'business');
        trackEvent('[Billing].upgradeSuccess', { team_uuid: teamUuid });
        updateTeamBilling({ isOnPaidPlan: true, planType: 'BUSINESS' });
        setShowUpgradeDialog({ open: false, eventSource: null });
        addGlobalSnackbar('Your plan has been upgraded to Business! 🎉', { severity: 'success' });
      } catch (error) {
        console.error('Failed to upgrade to Business:', error);
        addGlobalSnackbar('Failed to upgrade to Business. Please try again.', { severity: 'error' });
      } finally {
        setIsUpgradingToBusiness(false);
      }
    } else {
      // Free→Business: needs Stripe checkout, use the navigate/redirect flow
      navigate(ROUTES.TEAM_BILLING_SUBSCRIBE(teamUuid, { returnTo, plan: 'business' }));
    }
  };

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
        proAiAllowance={billingConfig.proAiAllowance}
      >
        {isFree ? (
          <Button
            disabled={!canManageBilling || isBusy}
            onClick={() => {
              setIsUpgradingToPro(true);
              trackEvent('[Billing].upgradeToProClicked', { eventSource });
              navigate(ROUTES.TEAM_BILLING_SUBSCRIBE(teamUuid, { returnTo }));
            }}
            className="mt-4 w-full"
            data-testid="billing-upgrade-to-pro-button"
          >
            {isUpgradingToPro && isNavigating ? 'Upgrading…' : 'Upgrade to Pro'}
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
        businessAiAllowance={billingConfig.businessAiAllowance}
      >
        {isFree || isPro ? (
          <Button
            disabled={!canManageBilling || isBusy}
            onClick={handleUpgradeToBusiness}
            className="mt-4 w-full"
            data-testid="billing-upgrade-to-business-button"
          >
            {isUpgradingToBusiness ? 'Upgrading…' : 'Upgrade to Business'}
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
