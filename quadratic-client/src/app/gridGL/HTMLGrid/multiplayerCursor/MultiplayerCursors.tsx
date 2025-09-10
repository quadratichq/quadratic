import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { MultiplayerCursor } from '@/app/gridGL/HTMLGrid/multiplayerCursor/MultiplayerCursor';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { memo, useEffect, useState } from 'react';
import './MultiplayerCursors.css';

const OFFSCREEN_SIZE = 10;

interface Props {
  topHeading: number;
  leftHeading: number;
}

export const MultiplayerCursors = memo((props: Props) => {
  // triggers a render
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setPlayersTrigger] = useState(0);
  useEffect(() => {
    const updatePlayersTrigger = () => setPlayersTrigger((x) => x + 1);

    events.on('multiplayerUpdate', updatePlayersTrigger);
    events.on('multiplayerChangeSheet', updatePlayersTrigger);
    events.on('multiplayerCursor', updatePlayersTrigger);
    events.on('changeSheet', updatePlayersTrigger);
    events.on('viewportChangedReady', updatePlayersTrigger);
    window.addEventListener('resize', updatePlayersTrigger);

    return () => {
      events.off('multiplayerUpdate', updatePlayersTrigger);
      events.off('multiplayerChangeSheet', updatePlayersTrigger);
      events.off('multiplayerCursor', updatePlayersTrigger);
      events.off('changeSheet', updatePlayersTrigger);
      events.off('viewportChangedReady', updatePlayersTrigger);
      window.removeEventListener('resize', updatePlayersTrigger);
    };
  }, []);

  const bounds = pixiApp.viewport.getVisibleBounds();

  return (
    <div className="multiplayer-cursors">
      {[...multiplayer.users].map(([id, player]) => {
        let { x, y, sheet_id, visible } = player;
        if (visible && x !== undefined && y !== undefined && sheet_id === sheets.current) {
          let offscreen = false;
          if (x > bounds.right) {
            offscreen = true;
            x = bounds.right - OFFSCREEN_SIZE;
          } else if (x < bounds.left) {
            offscreen = true;
            x = bounds.left + props.leftHeading;
          }
          if (y > bounds.bottom) {
            offscreen = true;
            y = bounds.bottom - OFFSCREEN_SIZE;
          } else if (y < bounds.top) {
            offscreen = true;
            y = bounds.top + props.topHeading;
          }

          const { first_name, last_name, email, index } = player;
          let name: string;
          if (first_name || last_name) {
            name = `${first_name} ${last_name}`;
          } else if (email) {
            name = email;
          } else {
            name = `User ${index + 1}`;
          }

          const color = player.colorString;
          return <MultiplayerCursor key={id} x={x} y={y} name={name} color={color} offscreen={offscreen} />;
        }
        return null;
      })}
    </div>
  );
});
