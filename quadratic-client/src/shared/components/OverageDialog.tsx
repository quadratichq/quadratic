import { hideOverageDialog, overageDialogAtom } from '@/shared/atom/overageDialogAtom';
import { showSettingsDialog } from '@/shared/atom/settingsDialogAtom';
import { teamBillingAtom } from '@/shared/atom/teamBillingAtom';
import { WarningIcon } from '@/shared/components/Icons';
import { OverageSettingsControls } from '@/shared/components/OverageSettingsControls';
import { useOverageSettings } from '@/shared/hooks/useOverageSettings';
import { useTeamData } from '@/shared/hooks/useTeamData';
import { Alert, AlertTitle } from '@/shared/shadcn/ui/alert';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { useAtom, useAtomValue } from 'jotai';
import { useCallback, useMemo } from 'react';

export function OverageDialog() {
  const [state, setState] = useAtom(overageDialogAtom);
  const { teamData } = useTeamData();
  const { planType, allowOveragePayments } = useAtomValue(teamBillingAtom);

  const team = teamData?.activeTeam?.team;
  const teamPermissions = teamData?.activeTeam?.userMakingRequest?.teamPermissions;
  const canManageAIOverage = useMemo(() => teamPermissions?.includes('TEAM_EDIT') ?? false, [teamPermissions]);
  const isBusiness = planType === 'BUSINESS';

  const overage = useOverageSettings({
    teamUuid: team?.uuid,
    enabled: state.open && isBusiness,
  });

  const handleSeeDetails = useCallback(() => {
    hideOverageDialog();
    showSettingsDialog('team');
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setState({ open: false });
      }
    },
    [setState]
  );

  const alertMessage = useMemo(() => {
    if (allowOveragePayments) {
      return 'Your team has reached its monthly AI spending limit.';
    }
    return 'Your team has exceeded the monthly AI allowance.';
  }, [allowOveragePayments]);

  if (!isBusiness || !team) return null;

  return (
    <Dialog open={state.open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{overage.onDemandUsage ? 'On-demand AI usage' : 'Enable on-demand AI usage'}</DialogTitle>
          <DialogDescription>
            {canManageAIOverage
              ? 'On-demand usage allows your team to continue using AI beyond the monthly allowance.'
              : 'You can view your team\u2019s AI usage in team settings.'}
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex flex-col gap-2">
          <Alert variant="warning">
            <WarningIcon />
            <AlertTitle className="mb-0">{alertMessage}</AlertTitle>
          </Alert>

          <div className="flex flex-col gap-4 pt-2">
            {canManageAIOverage ? (
              <OverageSettingsControls
                canManageAIOverage={canManageAIOverage}
                idPrefix="overage-dialog"
                overage={overage}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Ask a team editor or owner to enable on-demand usage, or view usage details in team settings.
              </p>
            )}

            <Button variant="link" onClick={handleSeeDetails} className="w-full">
              See detailed information
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
