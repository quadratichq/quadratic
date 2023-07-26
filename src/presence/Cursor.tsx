import React from 'react';
import { UserPresence as CursorProps } from './types';

export const Cursor = React.memo(({ cursor, color, name }: CursorProps) => {
  if (!cursor) return null;

  const { x, y, visible } = cursor;

  return (
    <div
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        userSelect: 'none',
        left: 0,
        top: 0,
        transition: 'transform 0.5s cubic-bezier(.17,.93,.38,1)',
        transform: `translateX(${x}px) translateY(${y}px) scale(${visible ? 1 : 0})`,
        zIndex: 1000000,
      }}
    >
      <svg
        className="cursor"
        width="24"
        height="36"
        viewBox="0 0 24 36"
        fill="none"
        stroke="white"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
          fill={color}
        />
      </svg>

      <div
        style={{
          backgroundColor: color,
          borderRadius: 2,
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
            fontSize: 11,
            color: 'white',
            lineHeight: '1em',
          }}
        >
          {name}
        </span>
      </div>
    </div>
  );
});
