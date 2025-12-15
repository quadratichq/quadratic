import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { ShareTeamDialog } from '@/shared/components/ShareDialog';

export const Component = () => {
  return (
    <>
      <DashboardHeader title="Team members" />

      <div className="w-full lg:max-w-lg">
        <ShareTeamDialog />
      </div>
    </>
  );
};
