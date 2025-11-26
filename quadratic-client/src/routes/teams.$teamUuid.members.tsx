import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { ShareTeamDialog } from '@/shared/components/ShareDialog';

export const Component = () => {
  const { activeTeam } = useDashboardRouteLoaderData();

  return (
    <>
      <DashboardHeader title="Team members" />

      <div className="w-full lg:max-w-lg">
        <ShareTeamDialog data={activeTeam} />
      </div>
    </>
  );
};
