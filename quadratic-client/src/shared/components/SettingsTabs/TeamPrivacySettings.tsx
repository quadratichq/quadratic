import { SettingControl } from '@/dashboard/components/SettingControl';
import { getActionUpdateTeam } from '@/routes/teams.$teamUuid';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CheckIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { DOCUMENTATION_ANALYTICS_AI } from '@/shared/constants/urls';
import { useTeamData } from '@/shared/hooks/useTeamData';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import type { TeamSettings as TeamSettingsType } from 'quadratic-shared/typesAndSchemas';
import { useCallback, useEffect, useMemo } from 'react';
import { Link, useFetcher, useLocation, useSubmit } from 'react-router';

export function TeamPrivacySettings() {
  const { teamData } = useTeamData();
  const submit = useSubmit();
  const fetcher = useFetcher({ key: 'update-team' });
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const location = useLocation();
  const returnTo = location.pathname + location.search;

  const activeTeam = teamData?.activeTeam;
  const team = activeTeam?.team;
  const teamPermissions = activeTeam?.userMakingRequest?.teamPermissions;
  const billing = activeTeam?.billing;

  // Optimistic UI
  const optimisticSettings = useMemo(() => {
    if (!team) return null;
    let settings = team.settings;
    if (fetcher.state !== 'idle' && isJsonObject(fetcher.json)) {
      const optimisticData = fetcher.json as { settings?: TeamSettingsType };
      if (optimisticData.settings) {
        settings = { ...settings, ...optimisticData.settings };
      }
    }
    return settings;
  }, [team, fetcher.state, fetcher.json]);

  const handleUpdatePreference = useCallback(
    (key: keyof TeamSettingsType, checked: boolean) => {
      if (!team) return;

      if (key === 'analyticsAi') {
        trackEvent('[Settings].toggleAnalyticsAi', {
          team_uuid: team.uuid,
          enabled: checked,
        });
      }

      const data = getActionUpdateTeam({ settings: { [key]: checked } });
      submit(data, {
        method: 'POST',
        action: ROUTES.TEAM(team.uuid),
        encType: 'application/json',
        fetcherKey: `update-team`,
        navigate: false,
      });
    },
    [submit, team]
  );

  // If for some reason it failed, display an error
  useEffect(() => {
    if (fetcher.data && fetcher.data.ok === false) {
      addGlobalSnackbar('Failed to save. Try again later.', { severity: 'error' });
    }
  }, [fetcher.data, addGlobalSnackbar]);

  const isOnPaidPlan = useMemo(() => billing?.status === 'ACTIVE', [billing?.status]);
  const canManageBilling = useMemo(() => teamPermissions?.includes('TEAM_MANAGE') ?? false, [teamPermissions]);

  if (!activeTeam || !team || !teamPermissions || !billing || !optimisticSettings) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-normal text-muted-foreground">Loading privacy settings...</p>
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
              You don't have permission to edit privacy settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Privacy Section */}
      <div className="space-y-4">
        <div>
          <p className="text-sm font-normal text-muted-foreground">Manage your team's privacy and data settings</p>
        </div>

        <SettingControl
          label="Help improve Quadratic"
          description={
            <>
              Enable the automated collection and analysis of some usage data.{' '}
              <a
                href={DOCUMENTATION_ANALYTICS_AI}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-primary"
              >
                Learn more
              </a>
              .
            </>
          }
          onCheckedChange={(checked) => {
            handleUpdatePreference('analyticsAi', checked);
          }}
          checked={optimisticSettings.analyticsAi}
          className="rounded-lg border border-border p-4 shadow-sm"
          disabled={!teamPermissions.includes('TEAM_MANAGE') || !isOnPaidPlan}
        >
          {!isOnPaidPlan && (
            <div className="flex items-center gap-1">
              <Badge variant="secondary">Available in Pro and Business plans</Badge>
              <Button
                asChild
                variant="link"
                onClick={() => {
                  trackEvent('[TeamSettings].upgradeToProClicked', {
                    team_uuid: team.uuid,
                    source: 'settings_dialog',
                  });
                }}
                size="sm"
                className="h-6"
                disabled={!canManageBilling}
              >
                <Link to={ROUTES.TEAM_BILLING_SUBSCRIBE(team.uuid, { returnTo })}>Upgrade now</Link>
              </Button>
            </div>
          )}
        </SettingControl>
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">When using AI features your data is sent to our AI providers:</p>
          <ul className="mt-2 space-y-2">
            {[
              'OpenAI',
              'Anthropic',
              'AWS Bedrock',
              'Google Cloud Vertex AI',
              'Microsoft Azure AI',
              'Baseten',
              'Fireworks',
            ].map((item, i) => (
              <li className="flex items-center gap-2 text-sm text-muted-foreground" key={i}>
                <CheckIcon className="h-4 w-4" /> <span className="font-medium">{item}:</span> zero-day data retention
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
