import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { memo } from 'react';

interface Props {
  x: number;
  y: number;
  name: string;
  color: string;
  offscreen: boolean;
  isAIAgent?: boolean;
  agentPersona?: string;
}

export const MultiplayerCursor = memo((props: Props) => {
  const { x, y, name, color, offscreen, isAIAgent, agentPersona } = props;

  if (offscreen) {
    return (
      <div
        className="multiplayer-cursor-offscreen"
        style={{
          transform: `translateX(${x}px) translateY(${y}px)`,
          backgroundColor: color,
        }}
      />
    );
  }

  // AI Agent cursor has a robot icon instead of the regular pointer
  if (isAIAgent) {
    return (
      <div
        className="multiplayer-cursor multiplayer-cursor-ai"
        style={{
          transform: `translateX(${x}px) translateY(${y}px) scale(${1 / pixiApp.viewport.scale.x})`,
        }}
      >
        {/* Robot icon for AI agents */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="3" y="8" width="18" height="12" rx="2" fill={color} />
          <circle cx="9" cy="14" r="2" fill="white" />
          <circle cx="15" cy="14" r="2" fill="white" />
          <line x1="12" y1="4" x2="12" y2="8" stroke={color} strokeWidth="2" />
          <circle cx="12" cy="3" r="2" fill={color} />
        </svg>

        <div
          style={{
            backgroundColor: color,
            position: 'absolute',
            top: 22,
            left: 4,
            display: 'flex',
            flexDirection: 'column',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          <span
            style={{
              whiteSpace: 'nowrap',
              fontSize: 11,
              fontWeight: 600,
              color: 'white',
              lineHeight: '1.2',
            }}
          >
            {name}
          </span>
          {agentPersona && (
            <span
              style={{
                whiteSpace: 'nowrap',
                fontSize: 9,
                color: 'rgba(255,255,255,0.8)',
                lineHeight: '1.2',
              }}
            >
              AI · {agentPersona}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="multiplayer-cursor"
      style={{
        transform: `translateX(${x}px) translateY(${y}px) scale(${1 / pixiApp.viewport.scale.x})`,
      }}
    >
      <svg width="24" height="36" viewBox="0 0 24 36" fill="none" stroke="white" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
          fill={color}
        />
      </svg>

      <div
        style={{
          backgroundColor: color,
          position: 'absolute',
          top: 18,
          left: 8,
          display: 'flex',
          padding: '0.25rem',
        }}
      >
        <span
          style={{
            whiteSpace: 'nowrap',
            fontSize: 12,
            color: 'white',
            lineHeight: '1',
          }}
        >
          {name}
        </span>
      </div>
    </div>
  );
});
