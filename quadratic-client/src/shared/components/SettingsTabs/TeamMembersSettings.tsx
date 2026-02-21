import { teamBillingAtom } from '@/shared/atom/teamBillingAtom';
import { ShareTeamDialog } from '@/shared/components/ShareDialog';
import { useTeamData } from '@/shared/hooks/useTeamData';
import { useAtomValue } from 'jotai';

export function TeamMembersSettings() {
  const { teamData } = useTeamData();
  const activeTeam = teamData?.activeTeam;
  const { isOnPaidPlan } = useAtomValue(teamBillingAtom);

  if (!activeTeam) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-normal text-muted-foreground">Loading team members...</p>
          </div>
        </div>
      </div>
    );
  }

  const { users } = activeTeam;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-normal text-muted-foreground">Manage who has access to your team</p>
        </div>
      </div>

      <div className="w-full max-w-2xl">
        <ShareTeamDialog />
      </div>

      {isOnPaidPlan && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Note on pricing:</strong> each user is billed at the per-seat rate set for your team. You currently
            have {users.length} billable seat{users.length !== 1 ? 's' : ''}.
          </p>
        </div>
      )}
    </div>
  );
}
