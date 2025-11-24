import { ShareTeamDialog } from '@/shared/components/ShareDialog';
import { useTeamData } from '@/shared/hooks/useTeamData';

export function TeamMembersSettings() {
  const { teamData } = useTeamData();
  const activeTeam = teamData?.activeTeam;

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

  const { billing, users } = activeTeam;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-normal text-muted-foreground">Manage who has access to your team</p>
        </div>
      </div>

      <div className="w-full max-w-2xl">
        <ShareTeamDialog data={activeTeam} />
      </div>

      {billing?.status === 'ACTIVE' && (
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
