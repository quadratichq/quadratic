import { BillingPlans } from '@/dashboard/billing/BillingPlans';
import { apiClient } from '@/shared/api/apiClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { TeamSubscriptionStatus, UserTeamRole } from 'quadratic-shared/typesAndSchemas';
import { useEffect, useRef } from 'react';
import { atom, useRecoilState, useSetRecoilState } from 'recoil';

export const showUpgradeDialogAtom = atom<boolean>({
  key: 'showUpgradeDialog',
  default: false,
});

// useEffect(() => {
//   trackEvent('[UpgradePage].loaded');
//   apiClient.teams.update(teamUuid, { clientDataKv: { lastSolicitationForProUpgrade: new Date().toISOString() } });
// }, [teamUuid]);

// const handleUpgrade = useCallback(async () => {
//   trackEvent('[UpgradePage].clickUpgrade');
//   setIsLoading(true);
//   apiClient.teams.billing.getCheckoutSessionUrl(teamUuid).then((data) => {
//     window.location.href = data.url;
//   });
// }, [teamUuid]);

// const handleNoThanks = useCallback(async () => {
//   trackEvent('[UpgradePage].clickNoThanks');
//   setIsLoading(true);
//   navigate(redirectTo);
// }, [redirectTo, navigate]);

export function UpgradeDialog({ teamUuid }: { teamUuid: string }) {
  const [open, setOpen] = useRecoilState(showUpgradeDialogAtom);

  // Track when dialog opens programmatically
  useEffect(() => {
    if (open) {
      console.log('opened');
      trackEvent('[UpgradeDialog].opened');
    } else {
      console.log('dismissed');
      trackEvent('[UpgradeDialog].dismissed');
    }
  }, [open]);

  const props = {
    // We hard-code these because we should only ever show this dialog if the right criteria are met.
    isOnPaidPlan: false,
    canManageBilling: true,

    teamUuid,
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upgrade to Pro</DialogTitle>
          <DialogDescription>Be sure to unlock all the individual and team features of Quadratic.</DialogDescription>
        </DialogHeader>
        <div className="relative flex flex-col gap-8">
          <BillingPlans {...props} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// TODO: turn this into an env var
const SOLICIT_UPGRADE_INTERVAL_SECONDS = 60;

// Use on the dashboard when we want to periodically check
export const UpgradeDialogWithPeriodicReminder = ({
  teamUuid,
  userMakingRequestTeamRole,
  lastSolicitationForProUpgrade,
  billingStatus,
}: {
  teamUuid: string;
  userMakingRequestTeamRole: UserTeamRole;
  lastSolicitationForProUpgrade: any;
  billingStatus: TeamSubscriptionStatus | undefined;
}) => {
  const ranAlready = useRef<boolean>(false);
  const setShowUpgradeDialog = useSetRecoilState(showUpgradeDialogAtom);

  useEffect(() => {
    // Only run this once
    if (ranAlready.current) return;
    ranAlready.current = true;

    // Not a team owner? No solicitation.
    if (userMakingRequestTeamRole !== 'OWNER') return;

    // Paid team? No solicitation.
    if (billingStatus === 'ACTIVE') return;

    // Get the value of the last time we solicited them
    const epochNow = Date.now();
    const epochLastSolicitationForProUpgrade = Date.parse(lastSolicitationForProUpgrade);

    if (isNaN(epochLastSolicitationForProUpgrade)) {
      // If we get here, it means the user has never been solicited for an upgrade.
      // (Or the data from the server got corrupted).
      // So we will (re)set the value in the API and they'll see it on the next interval.
      apiClient.teams.update(teamUuid, {
        clientDataKv: { lastSolicitationForProUpgrade: new Date(epochNow).toISOString() },
      });
      return;
    } else {
      // Has it been long enough since we last solicited an upgrade?
      const secondsSinceLastSolicitation = Math.floor((epochNow - epochLastSolicitationForProUpgrade) / 1000);
      if (secondsSinceLastSolicitation > SOLICIT_UPGRADE_INTERVAL_SECONDS) {
        // Show the dialog, and update the date/time we last solicited them
        setShowUpgradeDialog(true);
        apiClient.teams.update(teamUuid, {
          clientDataKv: { lastSolicitationForProUpgrade: new Date(epochNow).toISOString() },
        });
        return;
      }
    }
  }, [userMakingRequestTeamRole, lastSolicitationForProUpgrade, teamUuid, billingStatus, setShowUpgradeDialog]);

  return <UpgradeDialog teamUuid={teamUuid} />;
};
