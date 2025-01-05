import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { getActionUpdateTeam } from '@/routes/teams.$teamUuid';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import type { ReactNode} from 'react';
import { useEffect, useState } from 'react';
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
  // {teamPermissions.includes('TEAM_BILLING_EDIT') && (
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
      <div className={`mt-6 flex flex-col gap-6`}>
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
      </div>
    </>
  );
};

function Row(props: { children: ReactNode }) {
  return (
    <div className={`flex grid-cols-[160px_1fr] flex-col gap-2 sm:grid sm:max-w-lg sm:items-center`}>
      {props.children}
    </div>
  );
}
