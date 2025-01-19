import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { SettingControl } from '@/dashboard/components/SettingControl';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { getActionUpdateTeam, type TeamAction } from '@/routes/teams.$teamUuid';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CheckIcon } from '@/shared/components/Icons';
import { SettingPanel } from '@/shared/components/SettingPanel';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { DOCUMENTATION_ANALYTICS_AI, TRUST_CENTER } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import type { TeamSettings } from 'quadratic-shared/typesAndSchemas';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Navigate, useFetcher, useSubmit } from 'react-router-dom';

export const Component = () => {
  const {
    activeTeam: {
      team,
      userMakingRequest: { teamPermissions },
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

  // One day, when we have billing, we can add something akin to this
  //
  // {teamPermissions.includes('TEAM_MANAGE') && (
  //   <DropdownMenuItem
  //     onClick={() => {
  //       // Get the billing session URL
  //       apiClient.teams.billing.getPortalSessionUrl(team.uuid).then((data) => {
  //         window.location.href = data.url;
  //       });
  //     }}
  //   >
  //     Update billing
  //   </DropdownMenuItem>
  // )}

  // If for some reason it failed, display an error
  useEffect(() => {
    if (fetcher.data && fetcher.data.ok === false) {
      addGlobalSnackbar('Failed to save. Try again later.', { severity: 'error' });
    }
  }, [fetcher.data, addGlobalSnackbar]);

  // If you don’t have permission, you can't see this view
  if (!teamPermissions.includes('TEAM_EDIT')) {
    return <Navigate to={ROUTES.TEAM(team.uuid)} />;
  }

  // TODO: (jimniels) need to wire up this setting so it is saved to the team and delivered to the client

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

        <Row>
          <Type variant="body2" className="font-bold">
            AI
          </Type>

          <div className="flex flex-col gap-4 sm:grid sm:max-w-xl sm:items-center">
            <SettingPanel
              label="AI chats"
              description={
                <>
                  Enable AI chats and assistance throughout the app, including at the sheet and code level. Some sheet
                  data will be shared with AI models.{' '}
                  <a href={TRUST_CENTER} className="underline">
                    Learn more
                  </a>
                  .
                </>
              }
              checked={true}
              onCheckedChange={(newValue) => {}}
            />

            <SettingPanel
              label="AI researcher"
              description={
                <>
                  Perform automated research using AI models. In many cases, this features shares team member sheet data
                  with AI providers.{' '}
                  <a href={TRUST_CENTER} className="underline">
                    Learn more
                  </a>
                  .
                </>
              }
              checked={true}
              onCheckedChange={(newValue) => {}}
            />
          </div>
        </Row>

        {teamPermissions.includes('TEAM_MANAGE') && (
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
