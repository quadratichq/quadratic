import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { MultiplayerCursor } from '@/app/gridGL/HTMLGrid/multiplayerCursor/MultiplayerCursor';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { useEffect, useState } from 'react';
import './MultiplayerCursors.css';

const OFFSCREEN_SIZE = 10;

interface Props {
  topHeading: number;
  leftHeading: number;
}

export const MultiplayerCursors = (props: Props) => {
  // triggers a render
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setPlayersTrigger] = useState(0);
  useEffect(() => {
    const updatePlayersTrigger = () => setPlayersTrigger((x) => x + 1);
    events.on('multiplayerChangeSheet', updatePlayersTrigger);
    events.on('multiplayerCursor', updatePlayersTrigger);
    events.on('changeSheet', updatePlayersTrigger);
    window.addEventListener('resize', updatePlayersTrigger);
    events.on('viewportChangedReady', updatePlayersTrigger);
    return () => {
      events.off('multiplayerChangeSheet', updatePlayersTrigger);
      events.off('multiplayerCursor', updatePlayersTrigger);
      events.off('changeSheet', updatePlayersTrigger);
      window.removeEventListener('resize', updatePlayersTrigger);
      events.off('viewportChangedReady', updatePlayersTrigger);
    };
  }, []);

  return (
    <div className="multiplayer-cursors">
      {[...multiplayer.users].flatMap(([id, player]) => {
        let { x, y } = player;
        const { sheet_id, first_name, last_name, email, visible, index } = player;
        let name: string;
        if (first_name || last_name) {
          name = `${first_name} ${last_name}`;
        } else if (email) {
          name = email;
        } else {
          name = `User ${index + 1}`;
        }

        const color = player.colorString;
        const bounds = pixiApp.viewport.getVisibleBounds();
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
          return [<MultiplayerCursor key={id} x={x} y={y} name={name} color={color} offscreen={offscreen} />];
        }
        return [];
      })}
    </div>
  );
};
