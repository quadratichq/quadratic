import { CancellationDialog } from '@/components/CancellationDialog';
import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { SettingControl } from '@/dashboard/components/SettingControl';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { getActionUpdateTeam, type TeamAction } from '@/routes/teams.$teamUuid';
import { apiClient } from '@/shared/api/apiClient';
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
import { InfoCircledIcon, PieChartIcon } from '@radix-ui/react-icons';
import { getExperimentAIMsgCountLimit } from 'quadratic-shared/experiments/getExperimentAIMsgCountLimit';
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

  const handleNavigateToStripePortal = useCallback(() => {
    apiClient.teams.billing.getPortalSessionUrl(team.uuid).then((data) => {
      window.location.href = data.url;
    });
  }, [team.uuid]);

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
                <div className="grid grid-cols-2 gap-4">
                  {/* Free Plan */}
                  <div className={cn('rounded-lg border p-4', !isOnPaidPlan ? 'border-foreground' : 'border-border')}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Free plan</h3>
                      {!isOnPaidPlan && <Badge>Current plan</Badge>}
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">Team members</span>
                        <span className="text-sm font-medium">Limited</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">AI messages</span>
                        <span className="text-sm font-medium">Limited</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm">Connections</span>
                        <span className="text-right text-sm font-medium">Limited</span>
                      </div>
                    </div>
                  </div>

                  {/* Team AI Plan */}
                  <div className={cn('rounded-lg border p-4', isOnPaidPlan ? 'border-foreground' : 'border-border')}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Pro plan</h3>
                      {isOnPaidPlan && <Badge>Current plan</Badge>}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Team members</span>
                        <span className="text-right text-sm font-medium">
                          $20 <span className="text-xs text-muted-foreground">/user/month</span>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="flex items-center gap-1 text-sm">
                          AI messages
                          <Dialog>
                            <DialogTrigger>
                              <InfoCircledIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </DialogTrigger>
                            <DialogContent aria-describedby={undefined}>
                              <DialogHeader>
                                <DialogTitle>AI message limits</DialogTitle>
                              </DialogHeader>
                              <p className="text-sm text-muted-foreground">
                                We don't impose a strict limit on AI usage on the Pro plan. We reserve the right to
                                limit unreasonable use and abuse.
                              </p>
                            </DialogContent>
                          </Dialog>
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium">Many</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Connections</span>
                        <span className="text-right text-sm font-medium">Unlimited</span>
                      </div>
                    </div>
                    {!isOnPaidPlan ? (
                      <Button
                        disabled={!canManageBilling}
                        onClick={async () => {
                          const { events } = await getExperimentAIMsgCountLimit(team.uuid);
                          trackEvent('[TeamSettings].upgradeToProClicked', {
                            team_uuid: team.uuid,
                            ...events,
                          });
                          apiClient.teams.billing.getCheckoutSessionUrl(team.uuid).then((data) => {
                            window.location.href = data.url;
                          });
                        }}
                        className="mt-4 w-full"
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
                            // Do we track manage billing / cancel too?
                            // Nothing about this is persisted
                            trackEvent('[TeamSettings].manageBillingClicked', {
                              team_uuid: team.uuid,
                            });
                            handleNavigateToStripePortal();
                          }}
                        >
                          Manage subscription
                        </Button>
                        {canManageBilling && (
                          <CancellationDialog
                            teamUuid={team.uuid}
                            handleNavigateToStripePortal={handleNavigateToStripePortal}
                          />
                        )}
                      </div>
                    )}
                    {!canManageBilling && (
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        You cannot edit billing details. Contact{' '}
                        <Link to={ROUTES.TEAM_MEMBERS(team.uuid)} className="underline">
                          your team owner
                        </Link>
                        .
                      </p>
                    )}
                  </div>
                </div>

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
                label="Improve AI results"
                description={
                  <>
                    Help improve AI results by allowing Quadratic to store and analyze user prompts.{' '}
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
                disabled={!teamPermissions.includes('TEAM_MANAGE')}
              />
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
