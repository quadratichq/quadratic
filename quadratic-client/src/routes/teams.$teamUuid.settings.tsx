import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { SettingPanel } from '@/dashboard/components/SettingsPanel';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { getActionUpdateTeam } from '@/routes/teams.$teamUuid';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
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
      addGlobalSnackbar('Failed to update team name. Try again later.', { severity: 'error' });
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

        {teamPermissions.includes('TEAM_MANAGE') && (
          <Row>
            <Type variant="body2" className="font-bold">
              AI features
            </Type>
            <div className="flex flex-col gap-3 rounded border border-border p-4 shadow-sm">
              <SettingPanel
                label="Chat"
                description={
                  <>
                    Enable team members to use AI chat (where available). Some sheet data may be shared with AI models.{' '}
                    <a href="TODO:value-here" target="_blank" className="underline hover:text-primary">
                      Learn more.
                    </a>
                  </>
                }
                onCheckedChange={(checked) => {
                  console.log('checked', checked);
                }}
                checked={true}
              />
              <hr />
              <SettingPanel
                label="Prompt logs"
                description={
                  <>
                    Help improve AI by allowing Quadratic to store and analyze anonymized user prompts.{' '}
                    <a href="TODO:value-here" target="_blank" className="underline hover:text-primary">
                      Learn more
                    </a>
                    .
                  </>
                }
                onCheckedChange={(checked) => {
                  console.log('checked', checked);
                }}
                checked={true}
              />
              <hr />
              <SettingPanel
                label="Research (coming soon)"
                disabled={true}
                description={
                  <>
                    Enable team members to research information from the internet using prompts on individual cells.{' '}
                    <a
                      href="TODO:value-here"
                      target="_blank"
                      className="pointer-events-none underline hover:text-primary"
                    >
                      Learn more.
                    </a>
                  </>
                }
                onCheckedChange={(checked) => {
                  console.log('checked', checked);
                }}
                checked={false}
              />
            </div>
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
