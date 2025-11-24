import { BillingPlans } from '@/dashboard/billing/BillingPlans';
import { getActionUpdateTeam } from '@/routes/teams.$teamUuid';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ExternalLinkIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { PRICING_URL } from '@/shared/constants/urls';
import { useTeamData } from '@/shared/hooks/useTeamData';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/shadcn/ui/dialog';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { Separator } from '@/shared/shadcn/ui/separator';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { PieChartIcon } from '@radix-ui/react-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useFetcher, useSubmit } from 'react-router';

export function TeamSettings() {
  const { teamData } = useTeamData();
  const submit = useSubmit();
  const fetcher = useFetcher({ key: 'update-team' });
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const activeTeam = teamData?.activeTeam;
  const team = activeTeam?.team;
  const teamPermissions = activeTeam?.userMakingRequest?.teamPermissions;
  const billing = activeTeam?.billing;
  const users = activeTeam?.users;

  const [value, setValue] = useState<string>(team?.name ?? '');
  const disabled = useMemo(
    () => value === '' || value === team?.name || fetcher.state !== 'idle',
    [fetcher.state, team?.name, value]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (disabled || !team) {
        return;
      }

      trackEvent('[Settings].teamNameSaved', {
        team_uuid: team.uuid,
        new_name: value,
      });

      const data = getActionUpdateTeam({ name: value });
      submit(data, {
        method: 'POST',
        action: ROUTES.TEAM(team.uuid),
        encType: 'application/json',
        fetcherKey: `update-team`,
        navigate: false,
      });
    },
    [disabled, submit, team, value]
  );

  // If for some reason it failed, display an error
  useEffect(() => {
    if (fetcher.data && fetcher.data.ok === false) {
      addGlobalSnackbar('Failed to save. Try again later.', { severity: 'error' });
    }
  }, [fetcher.data, addGlobalSnackbar]);

  const latestUsage = useMemo(() => billing?.usage[0] || { ai_messages: 0 }, [billing?.usage]);
  const isOnPaidPlan = useMemo(() => billing?.status === 'ACTIVE', [billing?.status]);
  const canManageBilling = useMemo(() => teamPermissions?.includes('TEAM_MANAGE') ?? false, [teamPermissions]);

  if (!activeTeam || !team || !teamPermissions || !billing || !users) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-normal text-muted-foreground">Loading team settings...</p>
          </div>
        </div>
      </div>
    );
  }

  // If you don't have permission, show a message
  if (!teamPermissions.includes('TEAM_EDIT')) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-normal text-muted-foreground">
              You don't have permission to edit team settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Name Section */}
      <div className="space-y-4">
        <div>
          <p className="text-sm font-normal text-muted-foreground">Manage your team settings</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="team-name">Name</Label>
          <form className="flex items-center gap-2" onSubmit={handleSubmit}>
            <Input id="team-name" value={value} onChange={(e) => setValue(e.target.value)} className="max-w-md" />
            <Button type="submit" disabled={disabled} variant="secondary">
              Save
            </Button>
          </form>
        </div>
      </div>

      <Separator />

      {/* Billing Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Billing</h3>
        </div>

        <div className="flex flex-col gap-4">
          {/* Plan Comparison */}
          <BillingPlans
            isOnPaidPlan={isOnPaidPlan}
            canManageBilling={canManageBilling}
            teamUuid={team.uuid}
            eventSource="SettingsDialog"
          />

          {/* Current Usage */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Current usage</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  Team members{' '}
                  <span className="text-muted-foreground">
                    (
                    <Link to={ROUTES.TEAM_MEMBERS(team.uuid)} className="underline">
                      manage
                    </Link>
                    )
                  </span>
                </span>
                <span className="text-sm font-medium">{users.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Your AI messages</span>
                  <Dialog>
                    <DialogTrigger>
                      <PieChartIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </DialogTrigger>
                    <DialogContent aria-describedby={undefined}>
                      <DialogHeader>
                        <DialogTitle>Usage history</DialogTitle>
                      </DialogHeader>
                      <p className="mb-4 text-sm text-muted-foreground">Your billable AI messages per month.</p>
                      <div className="space-y-3">
                        {billing.usage.map((usage) => (
                          <div key={usage.month} className="flex justify-between">
                            <span>
                              {(function formatDate(dateStr: string) {
                                const [year, month] = dateStr.split('-');
                                const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                                return date.toLocaleDateString('en-US', {
                                  month: 'short',
                                  year: 'numeric',
                                });
                              })(usage.month)}
                            </span>
                            <span>{usage.ai_messages}</span>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <span className="text-sm font-medium">{latestUsage.ai_messages}</span>
              </div>
            </div>
          </div>

          <p className="pt-2 text-sm text-muted-foreground">
            Learn more on our{' '}
            <a href={PRICING_URL} target="_blank" rel="noreferrer" className="underline hover:text-primary">
              pricing page
              <ExternalLinkIcon className="relative top-1 ml-0.5 !text-sm" />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
