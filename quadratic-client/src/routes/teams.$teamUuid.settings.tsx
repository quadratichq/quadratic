import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { getActionUpdateTeam, useTeamRouteLoaderData } from '@/routes/teams.$teamUuid';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { ReactNode, useEffect } from 'react';
import { useFetcher, useSubmit } from 'react-router-dom';

// TODO: (connections) do this view
export const Component = () => {
  const { team } = useTeamRouteLoaderData();
  const submit = useSubmit();
  const fetcher = useFetcher({ key: 'update-team' });
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const onBlur = (e: any) => {
    const value = e.target.value;

    // Don't do anything if the name didn't change
    if (value === team.name) {
      return;
    }

    // Save it to the API
    const data = getActionUpdateTeam({ name: value });
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
    if (fetcher.data?.ok === false) {
      addGlobalSnackbar('Failed to update team name. Try again later.', { severity: 'error' });
    }
  }, [fetcher.data, addGlobalSnackbar]);

  return (
    <>
      <DashboardHeader title="Team settings" />
      <div className={`mt-6 flex flex-col gap-6`}>
        <Row>
          <Type variant="body2" className="font-bold">
            Team name
          </Type>
          <div className="flex items-center gap-2">
            <Input defaultValue={team.name} onBlur={onBlur} />
          </div>
        </Row>
        <Row>
          <Type variant="body2" className="font-bold">
            Billing
          </Type>
          <div className="flex items-center gap-2">
            <Button variant="outline">Manage</Button>
          </div>
        </Row>
      </div>
    </>
  );
};

function Row(props: { children: ReactNode }) {
  return (
    <div className={`grid max-w-lg items-center`} style={{ gridTemplateColumns: '160px 1fr' }}>
      {props.children}
    </div>
  );
}
