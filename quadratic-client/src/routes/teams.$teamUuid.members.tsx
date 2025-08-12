import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { ShareTeamDialog } from '@/shared/components/ShareDialog';

export const Component = () => {
  const { activeTeam } = useDashboardRouteLoaderData();
  const { billing, users } = activeTeam;

  return (
    <>
      <DashboardHeader title="Team members" />

      <div className="flex gap-12">
        <div className="w-full lg:max-w-lg">
          <ShareTeamDialog data={activeTeam} />
        </div>
        {billing?.status === 'ACTIVE' && (
          <p className="hidden w-64 text-sm text-muted-foreground lg:block">
            <strong>Note on pricing:</strong> each user is billed at the per-seat rate set for your team. You currently
            have {users.length} billable seat
            {users.length !== 1 ? 's' : ''}.
          </p>
        )}
      </div>
    </>
  );
};
