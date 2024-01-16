import { pixiApp } from '@/gridGL/pixiApp/PixiApp';

interface Props {
  x: number;
  y: number;
  name: string;
  color: string;
  offscreen: boolean;
}

export const MultiplayerCursor = (props: Props) => {
  const { x, y, name, color, offscreen } = props;

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
};
