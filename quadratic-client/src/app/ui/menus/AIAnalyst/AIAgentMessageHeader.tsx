import { AI_AGENT_PERSONA_CONFIG } from 'quadratic-shared/ai/multiplayerSession';
import type { AIAgentMessage } from 'quadratic-shared/ai/multiplayerSession';
import { memo } from 'react';
import { BotIcon, UserIcon } from 'lucide-react';
import { cn } from '@/shared/shadcn/utils';

interface AIAgentMessageHeaderProps {
  agentContext?: AIAgentMessage;
  className?: string;
}

/**
 * Header component that displays agent name and persona for AI multiplayer messages.
 * Shows nothing for regular (non-multiplayer) AI messages.
 */
export const AIAgentMessageHeader = memo(({ agentContext, className }: AIAgentMessageHeaderProps) => {
  if (!agentContext) {
    return null;
  }

  const { agentName, agentColor, isUserInfluence } = agentContext;

  if (isUserInfluence) {
    return (
      <div className={cn('flex items-center gap-2 text-sm', className)}>
        <div
          className="flex items-center justify-center rounded-full p-1"
          style={{ backgroundColor: '#6B7280' }}
        >
          <UserIcon size={12} className="text-white" />
        </div>
        <span className="font-medium text-muted-foreground">You (influence)</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <div
        className="flex items-center justify-center rounded-full p-1"
        style={{ backgroundColor: agentColor }}
      >
        <BotIcon size={12} className="text-white" />
      </div>
      <span className="font-medium" style={{ color: agentColor }}>
        {agentName}
      </span>
      <span className="text-xs text-muted-foreground">· Turn {agentContext.turnNumber}</span>
    </div>
  );
});

AIAgentMessageHeader.displayName = 'AIAgentMessageHeader';
