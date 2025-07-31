import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { SettingControl } from '@/dashboard/components/SettingControl';
import { AIUsageIndividual } from '@/dashboard/components/billing/AIUsageIndividual';
import { AIUsageTeam } from '@/dashboard/components/billing/AIUsageTeam';
import { BillingPlans } from '@/dashboard/components/billing/BillingPlans';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { getActionUpdateTeam, type TeamAction } from '@/routes/teams.$teamUuid';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CheckIcon } from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { DOCUMENTATION_ANALYTICS_AI, DOCUMENTATION_PRICING_URL, PRICING_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import type { TeamSettings } from 'quadratic-shared/typesAndSchemas';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFetcher, useSubmit } from 'react-router';

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

  // If for some reason it failed, display an error
  useEffect(() => {
    if (fetcher.data && fetcher.data.ok === false) {
      addGlobalSnackbar('Failed to save. Try again later.', { severity: 'error' });
    }
  }, [fetcher.data, addGlobalSnackbar]);

  const isOnPaidPlan = useMemo(() => billing.status === 'ACTIVE', [billing.status]);
  const canManageBilling = useMemo(() => teamPermissions.includes('TEAM_MANAGE'), [teamPermissions]);

  // TODO: get all this from the server, and pass in to the component
  const [usersUsage, setUsersUsage] = useState<
    {
      id: number;
      email: string;
      name: string;
      picture?: string;
      creditsMonthly: { used: number; limit: number };
      creditsAdditional: { used: number; limit: number };
    }[]
  >(
    users.map((user) => ({
      id: user.id,
      email: user.email || '',
      name: user.name || '',
      picture: user.picture,
      creditsMonthly: { used: 0, limit: 20 },
      creditsAdditional: { used: 0, limit: 20 },
    }))
  );
  // TODO: get from the server
  const [usageBasedPricingEnabled, setUsageBasedPricingEnabled] = useState(isOnPaidPlan ? true : false);

  const canEdit = teamPermissions.includes('TEAM_EDIT');
  const canManage = teamPermissions.includes('TEAM_MANAGE');

  return (
    <>
      <DashboardHeader title="Team settings" />
      <div className={`mt-6 flex flex-col gap-8`}>
        {canEdit && (
          <Section label="Name">
            <form className="flex items-center gap-2" onSubmit={handleSubmit}>
              <Input value={value} onChange={(e) => setValue(e.target.value)} className="max-w-sm" />
              <Button type="submit" disabled={disabled} variant="secondary">
                Save
              </Button>
            </form>
          </Section>
        )}

        <Section label="Billing plan">
          <div className="flex flex-col gap-2">
            <BillingPlans canManageBilling={canManageBilling} isOnPaidPlan={isOnPaidPlan} teamUuid={team.uuid} />
            <p className="text-right text-xs text-muted-foreground">
              Learn more on our{' '}
              <a href={PRICING_URL} target="_blank" rel="noreferrer" className="underline hover:text-primary">
                pricing page
              </a>
              .
            </p>
          </div>
        </Section>

        <Section label="Your AI usage">
          <div className="flex flex-col gap-2">
            <AIUsageIndividual
              creditsMonthly={usersUsage[0].creditsMonthly}
              creditsAdditional={isOnPaidPlan ? usersUsage[0].creditsAdditional : undefined}
            />
            <p className="text-right text-xs text-muted-foreground">
              Learn more about{' '}
              <a
                href={DOCUMENTATION_PRICING_URL}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-primary"
              >
                AI usage & pricing in our docs
              </a>
              .
            </p>
          </div>
        </Section>

        {canManage && (
          <Section label="Team AI Usage">
            <div className="flex flex-col gap-2">
              {isOnPaidPlan && (
                <SettingControl
                  label="Allow additional credit usage"
                  description={
                    <>
                      After their monthly credit allotment, allow users to continue using AI by setting a spending limit
                      for additional credits with usage-based pricing.{' '}
                      <a
                        // TODO: usage-based pricing link
                        href={DOCUMENTATION_PRICING_URL}
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
                    // handleUpdatePreference('aiUsageBasedPricingEnabled', checked);
                    setUsageBasedPricingEnabled(checked);
                  }}
                  checked={usageBasedPricingEnabled /*optimisticSettings.aiUsageBasedPricingEnabled*/}
                  className="rounded-lg border border-border p-4 shadow-sm"
                  disabled={!teamPermissions.includes('TEAM_MANAGE')}
                />
              )}
              <AIUsageTeam
                onChangeUserAdditionalLimit={
                  isOnPaidPlan && usageBasedPricingEnabled
                    ? ({ userId, limit }) => {
                        console.log('TODO: implement this so it sends to db', { userId, limit });
                        setUsersUsage((prev) =>
                          prev.map((user) =>
                            user.id === userId
                              ? { ...user, creditsAdditional: { ...user.creditsAdditional, limit } }
                              : user
                          )
                        );
                      }
                    : undefined
                }
                teamUuid={team.uuid}
                users={usersUsage.map((user) => ({
                  ...user,
                  creditsAdditional: isOnPaidPlan ? user.creditsAdditional : undefined,
                }))}
              />
            </div>
          </Section>
        )}

        <Section label="Privacy">
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
              disabled={!canManage}
            />
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                When using AI features your data is sent to our AI providers:
              </p>
              <ul className="mt-2 space-y-2">
                {['OpenAI', 'Anthropic', 'AWS Bedrock', 'Google Cloud'].map((item, i) => (
                  <li className="flex items-center gap-2 text-sm text-muted-foreground" key={i}>
                    <CheckIcon className="h-4 w-4" /> <span className="font-medium">{item}:</span> zero-day data
                    retention
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
};

function Section(props: { label: string; children: ReactNode }) {
  return (
    <div className={`flex grid-cols-[200px_1fr] flex-col gap-2 sm:grid sm:max-w-4xl`}>
      <div className="pt-2">
        <Type variant="body2" className="font-bold">
          {props.label}
        </Type>
      </div>
      {props.children}
    </div>
  );
}
