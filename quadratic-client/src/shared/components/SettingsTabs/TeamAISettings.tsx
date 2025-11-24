import { getActionUpdateTeam } from '@/routes/teams.$teamUuid';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import { useTeamData } from '@/shared/hooks/useTeamData';
import { Button } from '@/shared/shadcn/ui/button';
import { Label } from '@/shared/shadcn/ui/label';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFetcher, useSubmit } from 'react-router';

export function TeamAISettings() {
  const [teamAiRules, setTeamAiRules] = useState('');
  const [savedTeamAiRules, setSavedTeamAiRules] = useState('');
  const { teamData } = useTeamData();
  const submit = useSubmit();
  const fetcher = useFetcher({ key: 'update-team' });
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const team = teamData?.activeTeam?.team;
  const teamPermissions = teamData?.activeTeam?.userMakingRequest?.teamPermissions;

  const hasTeamRulesChanges = teamAiRules !== savedTeamAiRules;
  const canManageSettings = teamPermissions?.includes('TEAM_MANAGE') ?? false;

  // Optimistic UI - get current rules from team data or optimistic update
  const currentTeamAiRules = useMemo(() => {
    if (fetcher.state !== 'idle' && fetcher.json && typeof fetcher.json === 'object' && 'settings' in fetcher.json) {
      const optimisticData = fetcher.json as { settings?: { aiRules?: string | null } };
      if (optimisticData.settings?.aiRules !== undefined) {
        return optimisticData.settings.aiRules || '';
      }
    }
    return team?.settings?.aiRules || '';
  }, [team?.settings?.aiRules, fetcher.state, fetcher.json]);

  useEffect(() => {
    // Initialize from team data
    const rules = currentTeamAiRules;
    setTeamAiRules(rules);
    setSavedTeamAiRules(rules);
  }, [currentTeamAiRules]);

  const handleSaveTeamRules = useCallback(() => {
    if (!team || !canManageSettings) return;

    trackEvent('[Settings].teamAiRulesSaved', {
      team_uuid: team.uuid,
      has_rules: Boolean(teamAiRules),
      rules_length: teamAiRules?.length || 0,
    });

    const data = getActionUpdateTeam({ settings: { aiRules: teamAiRules || null } });
    submit(data, {
      method: 'POST',
      action: ROUTES.TEAM(team.uuid),
      encType: 'application/json',
      fetcherKey: `update-team`,
      navigate: false,
    });
  }, [team, teamAiRules, canManageSettings, submit]);

  const handleCancelTeamRules = () => {
    setTeamAiRules(savedTeamAiRules);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) to save
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (hasTeamRulesChanges && fetcher.state === 'idle' && canManageSettings) {
          handleSaveTeamRules();
        }
      }
    },
    [hasTeamRulesChanges, fetcher.state, canManageSettings, handleSaveTeamRules]
  );

  // Show error if save failed
  useEffect(() => {
    if (fetcher.data && fetcher.data.ok === false) {
      addGlobalSnackbar('Failed to save team AI rules', { severity: 'error' });
    } else if (fetcher.data && fetcher.data.ok === true && hasTeamRulesChanges) {
      // Success - update saved state
      setSavedTeamAiRules(teamAiRules);
      addGlobalSnackbar('Team AI rules saved successfully', { severity: 'success' });
    }
  }, [fetcher.data, addGlobalSnackbar, hasTeamRulesChanges, teamAiRules]);

  if (!team) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-normal text-muted-foreground">Loading team AI settings...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!canManageSettings) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-normal text-muted-foreground">
              You don't have permission to manage team AI settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Rules Section */}
      <div className="space-y-4">
        <div>
          <p className="text-sm font-normal text-muted-foreground">
            Add custom rules or instructions that will be sent with each AI prompt for all team members. These rules
            help guide the AI's behavior and responses for your team.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="team-ai-rules-editor">Team Rules for {team.name}</Label>
          <Textarea
            id="team-ai-rules-editor"
            value={teamAiRules}
            onChange={(e) => {
              if (canManageSettings) {
                setTeamAiRules(e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter team rules or instructions here..."
            className="min-h-[300px] font-mono text-sm"
            disabled={!canManageSettings}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleCancelTeamRules}
              disabled={!hasTeamRulesChanges || fetcher.state !== 'idle'}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveTeamRules} disabled={!hasTeamRulesChanges || fetcher.state !== 'idle'}>
              {fetcher.state !== 'idle' ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
