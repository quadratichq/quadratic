import { BillingPlans } from '@/dashboard/billing/BillingPlans';
import { apiClient } from '@/shared/api/apiClient';
import { showUpgradeDialogAtom } from '@/shared/atom/showUpgradeDialogAtom';
import { WarningIcon } from '@/shared/components/Icons';
import { Alert, AlertTitle } from '@/shared/shadcn/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useAtom, useSetAtom } from 'jotai';
import type { TeamSubscriptionStatus, UserTeamRole } from 'quadratic-shared/typesAndSchemas';
import { useEffect, useMemo, useRef } from 'react';
import { useNavigation } from 'react-router';

const SOLICIT_UPGRADE_INTERVAL_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface UpgradeDialogProps {
  teamUuid: string;
  canManageBilling: boolean;
}

export function UpgradeDialog({ teamUuid, canManageBilling }: UpgradeDialogProps) {
  const [state, setState] = useAtom(showUpgradeDialogAtom);

  const navigation = useNavigation();

  // Track when the dialog opens so we know where it came from
  useEffect(() => {
    if (state.open) {
      trackEvent('[UpgradeDialog].opened', { eventSource: state.eventSource });
    }
    if (state.eventSource === 'fileLimitReached') {
      trackEvent('[Billing].files.exceededBillingLimit', { location: 'UpgradeDialog' });
    }
  }, [state]);

  const upgradeTitle = useMemo(() => {
    switch (state.eventSource) {
      case 'fileLimitReached':
        return 'Upgrade to Pro for unlimited file editing';
      default:
        return 'Upgrade to Pro';
    }
  }, [state.eventSource]);

  const reasonText = useMemo(() => {
    switch (state.eventSource) {
      case 'fileLimitReached':
        return 'Some of your files require an upgrade to edit due to the free plan limit.';
      default:
        return undefined;
    }
  }, [state.eventSource]);

  return (
    <Dialog open={state.open} onOpenChange={() => setState({ open: false, eventSource: null })}>
      <DialogContent
        className={cn('max-w-2xl', navigation.state !== 'idle' && 'pointer-events-none opacity-50')}
        data-testid="upgrade-to-pro-dialog"
      >
        <DialogHeader>
          <DialogTitle>{upgradeTitle}</DialogTitle>
          <DialogDescription>Be sure to unlock all the individual and team features of Quadratic.</DialogDescription>
        </DialogHeader>
        <div className="relative flex flex-col gap-2">
          {reasonText && (
            <Alert variant="warning">
              <WarningIcon />
              <AlertTitle className="mb-0">{reasonText}</AlertTitle>
            </Alert>
          )}
          <BillingPlans
            teamUuid={teamUuid}
            isOnPaidPlan={false}
            canManageBilling={canManageBilling}
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
  canManageBilling,
}: {
  teamUuid: string;
  userMakingRequestTeamRole: UserTeamRole;
  lastSolicitationForProUpgrade: any;
  billingStatus: TeamSubscriptionStatus | undefined;
  canManageBilling: boolean;
}) => {
  const ranAlready = useRef<boolean>(false);
  const setShowUpgradeDialog = useSetAtom(showUpgradeDialogAtom);

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
        setShowUpgradeDialog({ open: true, eventSource: 'periodicSolicitation' });
        apiClient.teams.update(teamUuid, {
          clientDataKv: { lastSolicitationForProUpgrade: new Date(epochNow).toISOString() },
        });
        return;
      }
    }
  }, [userMakingRequestTeamRole, lastSolicitationForProUpgrade, teamUuid, billingStatus, setShowUpgradeDialog]);

  return <UpgradeDialog teamUuid={teamUuid} canManageBilling={canManageBilling} />;
};
