import { useAIMultiplayerSession } from '@/app/ai/hooks/useAIMultiplayerSession';
import {
  aiMultiplayerAgentsAtom,
  aiMultiplayerCurrentTurnAgentAtom,
  aiMultiplayerSessionActiveAtom,
  aiMultiplayerSessionStatusAtom,
  aiMultiplayerTurnNumberAtom,
} from '@/app/atoms/aiMultiplayerSessionAtom';
import { AIIcon, ArrowDownIcon, ArrowUpwardIcon, SaveAndRunIcon, StopIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { memo, useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';

export const AIMultiplayerControls = memo(() => {
  const isActive = useRecoilValue(aiMultiplayerSessionActiveAtom);
  const status = useRecoilValue(aiMultiplayerSessionStatusAtom);
  const agents = useRecoilValue(aiMultiplayerAgentsAtom);
  const currentTurnAgent = useRecoilValue(aiMultiplayerCurrentTurnAgentAtom);
  const turnNumber = useRecoilValue(aiMultiplayerTurnNumberAtom);

  const { pauseSession, resumeSession, endSession, sendUserInfluence, executeTurn } = useAIMultiplayerSession();

  const [influenceMessage, setInfluenceMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const handleSendInfluence = useCallback(() => {
    if (!influenceMessage.trim()) return;
    sendUserInfluence(influenceMessage.trim());
    setInfluenceMessage('');
  }, [influenceMessage, sendUserInfluence]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendInfluence();
      }
    },
    [handleSendInfluence]
  );

  if (!isActive) {
    return null;
  }

  return (
    <div className="flex flex-col rounded-lg border bg-background shadow-lg">
      {/* Header */}
      <div
        className="flex cursor-pointer items-center justify-between border-b px-4 py-2"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <AIIcon />
          <span className="font-medium">AI Multiplayer</span>
          <span className="text-sm text-muted-foreground">· Turn {turnNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {isExpanded ? <ArrowUpwardIcon /> : <ArrowDownIcon />}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Agents List */}
          <div className="flex flex-wrap gap-2 border-b px-4 py-3">
            {agents.map((agent) => {
              const isCurrentTurn = currentTurnAgent?.id === agent.id;
              return (
                <div
                  key={agent.id}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3 py-1 text-sm',
                    isCurrentTurn ? 'ring-2 ring-offset-2' : ''
                  )}
                  style={{
                    backgroundColor: `${agent.color}20`,
                    borderColor: agent.color,
                    // Use outline for dynamic color since ringColor isn't a CSS property
                    ...(isCurrentTurn ? { outlineColor: agent.color } : {}),
                  }}
                >
                  <div
                    className={cn(
                      'h-2 w-2 rounded-full',
                      agent.status === 'thinking' || agent.status === 'acting' ? 'animate-pulse' : ''
                    )}
                    style={{ backgroundColor: agent.color }}
                  />
                  <span style={{ color: agent.color }}>{agent.name}</span>
                  {isCurrentTurn && (
                    <span className="text-xs text-muted-foreground">
                      ({agent.status === 'thinking' ? 'thinking...' : agent.status === 'acting' ? 'acting...' : 'turn'})
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* User Influence Input */}
          <div className="flex gap-2 px-4 py-3">
            <Input
              placeholder="Send guidance to the agents..."
              value={influenceMessage}
              onChange={(e) => setInfluenceMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button size="icon" variant="outline" onClick={handleSendInfluence} disabled={!influenceMessage.trim()}>
              <SaveAndRunIcon />
            </Button>
          </div>

          {/* Control Buttons */}
          <div className="flex justify-between border-t px-4 py-2">
            <div className="flex gap-2">
              {status === 'paused' ? (
                <Button size="sm" variant="outline" onClick={() => resumeSession()}>
                  <SaveAndRunIcon className="mr-1" />
                  Resume
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => pauseSession()}>
                  <StopIcon className="mr-1" />
                  Pause
                </Button>
              )}
              {status === 'paused' && (
                <Button size="sm" variant="outline" onClick={() => executeTurn()}>
                  Step
                </Button>
              )}
            </div>
            <Button size="sm" variant="destructive" onClick={() => endSession()}>
              <StopIcon className="mr-1" />
              End Session
            </Button>
          </div>
        </>
      )}
    </div>
  );
});

AIMultiplayerControls.displayName = 'AIMultiplayerControls';

const StatusBadge = memo(({ status }: { status: string | null }) => {
  const statusConfig: Record<string, { label: string; className: string }> = {
    running: { label: 'Running', className: 'bg-green-500/20 text-green-700' },
    paused: { label: 'Paused', className: 'bg-yellow-500/20 text-yellow-700' },
    completed: { label: 'Completed', className: 'bg-blue-500/20 text-blue-700' },
    error: { label: 'Error', className: 'bg-red-500/20 text-red-700' },
    ended: { label: 'Ended', className: 'bg-gray-500/20 text-gray-700' },
  };

  const config = statusConfig[status ?? 'running'] ?? statusConfig.running;

  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', config.className)}>{config.label}</span>;
});

StatusBadge.displayName = 'StatusBadge';
