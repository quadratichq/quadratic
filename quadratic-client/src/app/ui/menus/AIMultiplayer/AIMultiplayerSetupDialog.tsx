import { useAIMultiplayerSession } from '@/app/ai/hooks/useAIMultiplayerSession';
import {
  aiMultiplayerPendingAgentsAtom,
  aiMultiplayerPendingConfigAtom,
  aiMultiplayerShowSetupModalAtom,
} from '@/app/atoms/aiMultiplayerSessionAtom';
import { Button } from '@/shared/shadcn/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/shadcn/ui/dialog';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import {
  AI_AGENT_PERSONA_CONFIG,
  type AIAgentDefinition,
  type AIAgentPersona,
} from 'quadratic-shared/ai/multiplayerSession';
import { memo, useCallback, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { BotIcon, PlusIcon, TrashIcon, PlayIcon } from 'lucide-react';

const PERSONAS: AIAgentPersona[] = [
  'DataAnalyst',
  'VisualizationExpert',
  'CodeOptimizer',
  'DataCleaner',
  'FormulaExpert',
  'GeneralAssistant',
];

export const AIMultiplayerSetupDialog = memo(() => {
  const [showModal, setShowModal] = useRecoilState(aiMultiplayerShowSetupModalAtom);
  const pendingAgents = useRecoilValue(aiMultiplayerPendingAgentsAtom);
  const pendingConfig = useRecoilValue(aiMultiplayerPendingConfigAtom);
  const { addPendingAgent, removePendingAgent, startSession, closeSetupModal } = useAIMultiplayerSession();

  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPersona, setNewAgentPersona] = useState<AIAgentPersona>('GeneralAssistant');
  const [newAgentInstructions, setNewAgentInstructions] = useState('');
  const [initialPrompt, setInitialPrompt] = useState('');

  const handleAddAgent = useCallback(() => {
    if (!newAgentName.trim()) return;

    const agent: AIAgentDefinition = {
      name: newAgentName.trim(),
      persona: newAgentPersona,
      customInstructions: newAgentInstructions.trim() || undefined,
    };
    addPendingAgent(agent);

    // Reset form
    setNewAgentName('');
    setNewAgentPersona('GeneralAssistant');
    setNewAgentInstructions('');
  }, [newAgentName, newAgentPersona, newAgentInstructions, addPendingAgent]);

  const handleStartSession = useCallback(async () => {
    if (pendingAgents.length === 0) return;
    await startSession(pendingAgents, pendingConfig, initialPrompt || undefined);
  }, [pendingAgents, pendingConfig, initialPrompt, startSession]);

  const handleClose = useCallback(() => {
    closeSetupModal();
    setNewAgentName('');
    setNewAgentPersona('GeneralAssistant');
    setNewAgentInstructions('');
    setInitialPrompt('');
  }, [closeSetupModal]);

  return (
    <Dialog open={showModal} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BotIcon size={20} />
            AI Multiplayer Session
          </DialogTitle>
          <DialogDescription>
            Create a collaborative AI session where multiple agents work together on your spreadsheet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4">
          {/* Added Agents */}
          {pendingAgents.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Agents ({pendingAgents.length}/5)</Label>
              <div className="flex flex-col gap-2">
                {pendingAgents.map((agent, index) => {
                  const personaConfig = AI_AGENT_PERSONA_CONFIG[agent.persona];
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border p-3"
                      style={{ borderColor: personaConfig.defaultColor }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          style={{ backgroundColor: personaConfig.defaultColor }}
                        >
                          <BotIcon size={16} className="text-white" />
                        </div>
                        <div>
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-sm text-muted-foreground">{personaConfig.displayName}</div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removePendingAgent(index)}>
                        <TrashIcon size={16} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add New Agent Form */}
          {pendingAgents.length < 5 && (
            <div className="flex flex-col gap-4 rounded-lg border p-4">
              <Label className="text-base">Add Agent</Label>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="agent-name">Name</Label>
                  <Input
                    id="agent-name"
                    placeholder="e.g., Data Explorer"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="agent-persona">Persona</Label>
                  <Select value={newAgentPersona} onValueChange={(v) => setNewAgentPersona(v as AIAgentPersona)}>
                    <SelectTrigger id="agent-persona">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERSONAS.map((persona) => (
                        <SelectItem key={persona} value={persona}>
                          {AI_AGENT_PERSONA_CONFIG[persona].displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                {AI_AGENT_PERSONA_CONFIG[newAgentPersona].description}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="agent-instructions">Custom Instructions (optional)</Label>
                <Textarea
                  id="agent-instructions"
                  placeholder="Additional instructions for this agent..."
                  value={newAgentInstructions}
                  onChange={(e) => setNewAgentInstructions(e.target.value)}
                  rows={2}
                />
              </div>

              <Button variant="outline" onClick={handleAddAgent} disabled={!newAgentName.trim()} className="w-fit">
                <PlusIcon size={16} className="mr-2" />
                Add Agent
              </Button>
            </div>
          )}

          {/* Initial Prompt */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="initial-prompt">Initial Goal (optional)</Label>
            <Textarea
              id="initial-prompt"
              placeholder="What should the agents work on? e.g., 'Analyze the sales data and create visualizations'"
              value={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              rows={3}
            />
            <p className="text-sm text-muted-foreground">
              This will guide the agents when they start working together.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleStartSession} disabled={pendingAgents.length === 0}>
            <PlayIcon size={16} className="mr-2" />
            Start Session ({pendingAgents.length} agent{pendingAgents.length !== 1 ? 's' : ''})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

AIMultiplayerSetupDialog.displayName = 'AIMultiplayerSetupDialog';
