import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { PreferenceControl } from '@/dashboard/components/PreferenceControl';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { getActionUpdateTeam, type TeamAction } from '@/routes/teams.$teamUuid';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import type { TeamSettings } from 'quadratic-shared/typesAndSchemas';
import { ReactNode, useEffect, useState } from 'react';
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

        {teamPermissions.includes('TEAM_MANAGE') && optimisticSettings && (
          <Row>
            <Type variant="body2" className="font-bold">
              Privacy
            </Type>

            <PreferenceControl
              label="Improve AI results"
              description={
                <>
                  Help improve AI results by allowing Quadratic to store and analyze user prompts.{' '}
                  <a href="TODO:value-here" target="_blank" className="underline hover:text-primary">
                    Learn more
                  </a>
                  .
                </>
              }
              onCheckedChange={(checked) => {
                handleUpdatePreference('analyticsAi', checked);
              }}
              checked={optimisticSettings.analyticsAi}
              className="rounded border border-border p-3 shadow-sm"
            />
          </Row>
        )}
      </div>
    </>
  );
};

function Row(props: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(`flex grid-cols-[160px_1fr] flex-col gap-2 sm:grid sm:max-w-2xl sm:items-center`, props.className)}
    >
      {props.children}
    </div>
  );
}
