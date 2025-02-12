import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { SettingControl } from '@/dashboard/components/SettingControl';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { getActionUpdateTeam, type TeamAction } from '@/routes/teams.$teamUuid';
import { apiClient } from '@/shared/api/apiClient';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CheckIcon } from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { DOCUMENTATION_ANALYTICS_AI } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/shadcn/ui/dialog';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import type { TeamSettings } from 'quadratic-shared/typesAndSchemas';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Navigate, useFetcher, useSubmit } from 'react-router-dom';

export const Component = () => {
  const {
    activeTeam: {
      team,
      userMakingRequest: { teamPermissions },
      billing,
      users,
      files,
      filesPrivate,
    },
  } = useDashboardRouteLoaderData();

  const submit = useSubmit();
  const fetcher = useFetcher({ key: 'update-team' });
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [value, setValue] = useState<string>(team.name);
  const disabled = value === '' || value === team.name || fetcher.state !== 'idle';

  // Optimistic UI
  let optimisticSettings = team.settings;
  if (fetcher.state !== 'idle' && isJsonObject(fetcher.json)) {
    const optimisticData = fetcher.json as TeamAction['request.update-team'];

    if (optimisticData.settings) {
      optimisticSettings = { ...optimisticSettings, ...optimisticData.settings };
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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
  };

  const handleUpdatePreference = (key: keyof TeamSettings, checked: boolean) => {
    const data = getActionUpdateTeam({ settings: { [key]: checked } });
    submit(data, {
      method: 'POST',
      action: ROUTES.TEAM(team.uuid),
      encType: 'application/json',
      fetcherKey: `update-team`,
      navigate: false,
    });
  };

  // If for some reason it failed, display an error
  useEffect(() => {
    if (fetcher.data && fetcher.data.ok === false) {
      addGlobalSnackbar('Failed to save. Try again later.', { severity: 'error' });
    }
  }, [fetcher.data, addGlobalSnackbar]);

  // If you don't have permission, you can't see this view
  if (!teamPermissions.includes('TEAM_EDIT')) {
    return <Navigate to={ROUTES.TEAM(team.uuid)} />;
  }

  const latestUsage = billing.usage[0] || { ai_messages: 0 };

  return (
    <>
      <DashboardHeader title="Team settings" />
      <div className={`mt-6 flex flex-col gap-8`}>
        <Row>
          <Type variant="body2" className="font-bold">
            Name
          </Type>
          <form className="flex items-center gap-2" onSubmit={handleSubmit}>
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
            <Button type="submit" disabled={disabled} variant="secondary">
              Save
            </Button>
          </form>
        </Row>

        {teamPermissions.includes('TEAM_MANAGE') && (
          <>
            <Row>
              <Type variant="body2" className="font-bold">
                Billing
              </Type>
              <div className="flex flex-col gap-4">
                {/* Plan Comparison */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Free Plan */}
                  <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Free Plan</h3>
                      {billing.status === undefined && (
                        <span className="rounded-full bg-muted px-2 py-1 text-xs">Current Plan</span>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">AI Messages / User / Month</span>
                        <span className="text-sm font-medium">50</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Connection Runs / Month</span>
                        <span className="text-sm font-medium">∞</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Team Members</span>
                        <span className="text-sm font-medium">∞</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Files</span>
                        <span className="text-sm font-medium">∞</span>
                      </div>
                    </div>
                  </div>

                  {/* Team AI Plan */}
                  <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Team Plan</h3>
                      {billing.status === 'ACTIVE' && (
                        <span className="rounded-full bg-muted px-2 py-1 text-xs">Current Plan</span>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">AI Messages / User / Month</span>
                        <span className="text-sm font-medium">∞</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Connection Runs / Month</span>
                        <span className="text-sm font-medium">∞</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Team Members</span>
                        <span className="text-sm font-medium">∞</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Files</span>
                        <span className="text-sm font-medium">∞</span>
                      </div>
                    </div>
                    {billing.status === undefined ? (
                      <Button
                        onClick={() => {
                          apiClient.teams.billing.getCheckoutSessionUrl(team.uuid).then((data) => {
                            window.location.href = data.url;
                          });
                        }}
                        className="mt-4 w-full"
                      >
                        Upgrade Team
                      </Button>
                    ) : (
                      billing.status === 'ACTIVE' && (
                        <Button
                          variant="secondary"
                          className="mt-4 w-full"
                          onClick={() => {
                            apiClient.teams.billing.getPortalSessionUrl(team.uuid).then((data) => {
                              window.location.href = data.url;
                            });
                          }}
                        >
                          Manage Billing
                        </Button>
                      )
                    )}
                  </div>
                </div>

                {/* Current Usage */}
                <div className="rounded-lg border border-border p-4">
                  <h3 className="mb-3 text-lg font-semibold">Current Usage</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">AI Messages / User / Month</span>
                        <Dialog>
                          <DialogTrigger>
                            <InfoCircledIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Usage History</DialogTitle>
                            </DialogHeader>
                            <p className="mb-4 text-sm text-muted-foreground">
                              Users receive 50 free AI messages per month across all teams. If a user belongs to a paid
                              team, they'll use that team's unlimited messages instead.
                            </p>
                            <div className="space-y-3">
                              {billing.usage.map((usage) => (
                                <div key={usage.month} className="flex justify-between">
                                  <span>{usage.month}</span>
                                  <span>{usage.ai_messages}</span>
                                </div>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-4 text-right font-medium">{latestUsage.ai_messages}</span>
                        <span className="w-8 translate-y-[5px] text-xs text-muted-foreground">
                          / {billing.status === undefined ? '50' : '∞'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Connection Runs / Month</span>
                      <div className="flex items-start gap-2">
                        <span className="w-4 text-right font-medium">-</span>
                        <span className="w-8 translate-y-[5px] text-xs text-muted-foreground">/ ∞</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Team Members</span>
                      <div className="flex items-start gap-2">
                        <span className="w-4 text-right font-medium">{users.length}</span>
                        <span className="w-8 translate-y-[5px] text-xs text-muted-foreground">/ ∞</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Files</span>
                      <div className="flex items-start gap-2">
                        <span className="w-4 text-right font-medium">{files.length + filesPrivate.length}</span>
                        <span className="w-8 translate-y-[5px] text-xs text-muted-foreground">/ ∞</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Row>
            <Row>
              <Type variant="body2" className="font-bold">
                Privacy
              </Type>

              <div>
                <SettingControl
                  label="Improve AI results"
                  description={
                    <>
                      Help improve AI results by allowing Quadratic to store and analyze user prompts.{' '}
                      <a href={DOCUMENTATION_ANALYTICS_AI} target="_blank" className="underline hover:text-primary">
                        Learn more
                      </a>
                      .
                    </>
                  }
                  onCheckedChange={(checked) => {
                    handleUpdatePreference('analyticsAi', checked);
                  }}
                  checked={optimisticSettings.analyticsAi}
                  className="rounded border border-border px-3 py-2 shadow-sm"
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  When using AI features your data is sent to our AI providers:
                </p>
                <ul className="mt-2 text-sm text-muted-foreground">
                  {['OpenAI', 'Anthropic', 'AWS Bedrock'].map((item, i) => (
                    <li className="flex items-center gap-2" key={i}>
                      <CheckIcon /> <span className="font-semibold">{item}:</span> zero-day data retention
                    </li>
                  ))}
                </ul>
              </div>
            </Row>
          </>
        )}
      </div>
    </>
  );
};

function Row(props: { children: ReactNode[]; className?: string }) {
  if (props.children.length !== 2) {
    throw new Error('Row must have exactly two children');
  }

  return (
    <div className={cn(`flex grid-cols-[160px_1fr] flex-col gap-2 sm:grid sm:max-w-2xl`, props.className)}>
      <div className="pt-2">{props.children[0]}</div>
      <div className="">{props.children[1]}</div>
    </div>
  );
}
