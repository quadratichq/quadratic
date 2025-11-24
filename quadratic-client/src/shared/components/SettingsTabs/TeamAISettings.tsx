import { useTeamData } from '@/shared/hooks/useTeamData';
import { Button } from '@/shared/shadcn/ui/button';
import { Label } from '@/shared/shadcn/ui/label';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { useState } from 'react';

export function TeamAISettings() {
  const [teamAiRules, setTeamAiRules] = useState('');
  const [savedTeamAiRules, setSavedTeamAiRules] = useState('');
  const { teamData } = useTeamData();
  const team = teamData?.activeTeam?.team;

  const hasTeamRulesChanges = teamAiRules !== savedTeamAiRules;

  const handleSaveTeamRules = () => {
    // TODO: Save to API when available
    setSavedTeamAiRules(teamAiRules);
  };

  const handleCancelTeamRules = () => {
    setTeamAiRules(savedTeamAiRules);
  };

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
            onChange={(e) => setTeamAiRules(e.target.value)}
            placeholder="Enter team rules or instructions here..."
            className="min-h-[300px] font-mono text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancelTeamRules} disabled={!hasTeamRulesChanges}>
              Cancel
            </Button>
            <Button onClick={handleSaveTeamRules} disabled={!hasTeamRulesChanges}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
