import { teamBillingAtom } from '@/shared/atom/teamBillingAtom';
import { OverageSettingsControls } from '@/shared/components/OverageSettingsControls';
import { useOverageSettings } from '@/shared/hooks/useOverageSettings';
import { useTeamData } from '@/shared/hooks/useTeamData';
import { cn } from '@/shared/shadcn/utils';
import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';

interface BusinessPlanSettingsProps {
  highlight?: boolean;
}

export function BusinessPlanSettings({ highlight }: BusinessPlanSettingsProps) {
  const { teamData } = useTeamData();

  const activeTeam = teamData?.activeTeam;
  const team = activeTeam?.team;
  const teamPermissions = activeTeam?.userMakingRequest?.teamPermissions;

  const { planType } = useAtomValue(teamBillingAtom);
  const canManageAIOverage = useMemo(() => teamPermissions?.includes('TEAM_EDIT') ?? false, [teamPermissions]);
  const isBusiness = planType === 'BUSINESS';

  const overage = useOverageSettings({
    teamUuid: team?.uuid,
    enabled: isBusiness,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);

  useEffect(() => {
    if (highlight && containerRef.current) {
      const scrollTimeout = setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

      const highlightTimeout = setTimeout(() => {
        setIsHighlighted(true);
        setTimeout(() => setIsHighlighted(false), 3000);
      }, 600);

      return () => {
        clearTimeout(scrollTimeout);
        clearTimeout(highlightTimeout);
      };
    }
  }, [highlight]);

  if (!isBusiness || !team) {
    return null;
  }

  return (
    <div ref={containerRef} className="space-y-4">
      <h4 className="text-sm font-semibold">Business plan settings</h4>

      <div
        className={cn(
          'rounded-lg border border-border p-4 transition-all duration-500',
          isHighlighted && 'border-primary bg-primary/5 ring-2 ring-primary ring-offset-2'
        )}
      >
        <OverageSettingsControls canManageAIOverage={canManageAIOverage} idPrefix="settings" overage={overage} />
      </div>
    </div>
  );
}
