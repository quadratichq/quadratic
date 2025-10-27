import { BillingPlans } from '@/dashboard/billing/BillingPlans';
import { apiClient } from '@/shared/api/apiClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { TeamSubscriptionStatus, UserTeamRole } from 'quadratic-shared/typesAndSchemas';
import { useEffect, useRef } from 'react';
import { useNavigation } from 'react-router';
import { atom, useRecoilState, useSetRecoilState } from 'recoil';

// Default to 7 days if there's no env var
const SOLICIT_UPGRADE_INTERVAL_SECONDS = import.meta.env.VITE_SOLICIT_UPGRADE_INTERVAL_SECONDS ?? 60 * 60 * 24 * 7;

export const showUpgradeDialogAtom = atom<{ open: false; eventSource: null } | { open: true; eventSource: string }>({
  key: 'showUpgradeDialog',
  default: { open: false, eventSource: null },
});

export function UpgradeDialog({ teamUuid }: { teamUuid: string }) {
  const [state, setState] = useRecoilState(showUpgradeDialogAtom);
  const navigation = useNavigation();

  // Track when the dialog opens so we know where it came from
  useEffect(() => {
    if (state.open) {
      trackEvent('[UpgradeDialog].opened', { eventSource: state.eventSource });
    }
  }, [state]);

  return (
    <Dialog open={state.open} onOpenChange={() => setState({ open: false, eventSource: null })}>
      <DialogContent className={cn('max-w-2xl', navigation.state !== 'idle' && 'pointer-events-none opacity-50')}>
        <DialogHeader>
          <DialogTitle>Upgrade to Pro</DialogTitle>
          <DialogDescription>Be sure to unlock all the individual and team features of Quadratic.</DialogDescription>
        </DialogHeader>
        <div className="relative flex flex-col gap-8">
          <BillingPlans
            teamUuid={teamUuid}
            // We hard-code these because we should only ever show this dialog if the right criteria are met.
            isOnPaidPlan={false}
            canManageBilling={true}
            eventSource={`UpgradeDialog-${state.eventSource}`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * This is the upgrade dialog, but with special logic to periodically show itself
 * to the user based on the last time we solicited them.
 *
 * We use this on the dashboard only. The app uses the regular <UpgradeDialog />
 */
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
        setShowUpgradeDialog({ open: true, eventSource: 'periodicSolitication' });
        apiClient.teams.update(teamUuid, {
          clientDataKv: { lastSolicitationForProUpgrade: new Date(epochNow).toISOString() },
        });
        return;
      }
    }
  }, [userMakingRequestTeamRole, lastSolicitationForProUpgrade, teamUuid, billingStatus, setShowUpgradeDialog]);

  return <UpgradeDialog teamUuid={teamUuid} />;
};
