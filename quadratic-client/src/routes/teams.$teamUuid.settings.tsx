import { BillingPlans } from '@/dashboard/billing/BillingPlans';
import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { SettingControl } from '@/dashboard/components/SettingControl';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { getActionUpdateTeam, type TeamAction } from '@/routes/teams.$teamUuid';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CheckIcon, ExternalLinkIcon } from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { DOCUMENTATION_ANALYTICS_AI, PRICING_URL } from '@/shared/constants/urls';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/shadcn/ui/dialog';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import { PieChartIcon } from '@radix-ui/react-icons';
import type { TeamSettings } from 'quadratic-shared/typesAndSchemas';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useFetcher, useSubmit } from 'react-router';

export const Component = () => {
  const {
    activeTeam: {
      team,
      userMakingRequest: { teamPermissions },
      billing,
      users,
    },
  } = useDashboardRouteLoaderData();
  const submit = useSubmit();
  const fetcher = useFetcher({ key: 'update-team' });
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [value, setValue] = useState<string>(team.name);
  const disabled = useMemo(
    () => value === '' || value === team.name || fetcher.state !== 'idle',
    [fetcher.state, team.name, value]
  );

  // Optimistic UI
  let optimisticSettings = team.settings;
  if (fetcher.state !== 'idle' && isJsonObject(fetcher.json)) {
    const optimisticData = fetcher.json as TeamAction['request.update-team'];

    if (optimisticData.settings) {
      optimisticSettings = { ...optimisticSettings, ...optimisticData.settings };
    }
  }

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (disabled) {
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
    [disabled, submit, team.uuid, value]
  );

  const handleUpdatePreference = useCallback(
    (key: keyof TeamSettings, checked: boolean) => {
      const data = getActionUpdateTeam({ settings: { [key]: checked } });
      submit(data, {
        method: 'POST',
        action: ROUTES.TEAM(team.uuid),
        encType: 'application/json',
        fetcherKey: `update-team`,
        navigate: false,
      });
    },
    [submit, team.uuid]
  );

  // If for some reason it failed, display an error
  useEffect(() => {
    if (fetcher.data && fetcher.data.ok === false) {
      addGlobalSnackbar('Failed to save. Try again later.', { severity: 'error' });
    }
  }, [fetcher.data, addGlobalSnackbar]);

  const latestUsage = useMemo(() => billing.usage[0] || { ai_messages: 0 }, [billing.usage]);
  const isOnPaidPlan = useMemo(() => billing.status === 'ACTIVE', [billing.status]);
  const canManageBilling = useMemo(() => teamPermissions.includes('TEAM_MANAGE'), [teamPermissions]);

  // If you don't have permission, you can't see this view
  if (!teamPermissions.includes('TEAM_EDIT')) {
    return <Navigate to={ROUTES.TEAM(team.uuid)} />;
  }

  return (
    <>
      <DashboardHeader title="Team settings" />
      <div className={`mt-6 flex flex-col gap-8`}>
        <SettingsRow className="sm:max-w-xl">
          <Type variant="body2" className="font-bold">
            Name
          </Type>
          <form className="flex items-center gap-2" onSubmit={handleSubmit}>
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
            <Button type="submit" disabled={disabled} variant="secondary">
              Save
            </Button>
          </form>
        </SettingsRow>

        <>
          <SettingsRow>
            <Type variant="body2" className="font-bold">
              Billing
            </Type>
            <div>
              <div className="flex flex-col gap-4">
                {/* Plan Comparison */}
                <BillingPlans
                  isOnPaidPlan={isOnPaidPlan}
                  canManageBilling={canManageBilling}
                  teamUuid={team.uuid}
                  eventSource="TeamSettings"
                />

                {/* Current Usage */}
                <div>
                  <h3 className="text-md mb-3 font-semibold">Current usage</h3>
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

                      <div className="flex items-start gap-2">
                        <span className="w-4 text-left font-medium">{users.length}</span>
                      </div>
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
                      <div className="flex items-start gap-2">
                        <span className="w-4 text-left font-medium">{latestUsage.ai_messages}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="pt-4 text-sm text-muted-foreground">
                Learn more on our{' '}
                <a href={PRICING_URL} target="_blank" rel="noreferrer" className="underline hover:text-primary">
                  pricing page
                  <ExternalLinkIcon className="relative top-1 ml-0.5 !text-sm" />
                </a>
              </p>
            </div>
          </SettingsRow>
          <SettingsRow>
            <Type variant="body2" className="font-bold">
              Privacy
            </Type>

            <div>
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
                    <Badge variant="secondary">Exclusive to Pro</Badge>
                    <Button
                      asChild
                      variant="link"
                      onClick={() => {
                        trackEvent('[TeamSettings].upgradeToProClicked', {
                          team_uuid: team.uuid,
                          source: 'privacy_section',
                        });
                      }}
                      size="sm"
                      className="h-6"
                      disabled={!canManageBilling}
                    >
                      <Link to={ROUTES.TEAM_BILLING_SUBSCRIBE(team.uuid)}>Upgrade now</Link>
                    </Button>
                  </div>
                )}
              </SettingControl>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">
                  When using AI features your data is sent to our AI providers:
                </p>
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
                      <CheckIcon className="h-4 w-4" /> <span className="font-medium">{item}:</span> zero-day data
                      retention
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </SettingsRow>
          <SettingsRow>
            <Type variant="body2" className="font-bold">
              File recovery
            </Type>
            <div>
              <Button variant="outline" asChild>
                <Link
                  to={ROUTES.TEAM_FILES_DELETED(team.uuid)}
                  onClick={() => trackEvent('[TeamSettings].viewDeletedFiles')}
                >
                  Recover deleted files
                </Link>
              </Button>
              <p className="mt-2 text-sm text-muted-foreground">
                Files deleted in the last 30 days remain available for recovery.
              </p>
            </div>
          </SettingsRow>
        </>
      </div>
    </>
  );
};

function SettingsRow(props: { children: ReactNode[]; className?: string }) {
  if (props.children.length !== 2) {
    throw new Error('Row must have exactly two children');
  }

  return (
    <div className={cn(`flex grid-cols-[160px_1fr] flex-col gap-2 sm:grid sm:max-w-3xl`, props.className)}>
      <div className="pt-2">{props.children[0]}</div>
      <div className="">{props.children[1]}</div>
    </div>
  );
}
