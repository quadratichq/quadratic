import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { FederatedPointerEvent } from 'pixi.js';
import { useEffect, useState } from 'react';

export const Coordinates = () => {
  const [coordinates, setCoordinates] = useState('');

  useEffect(() => {
    const updateCoordinates = (e: FederatedPointerEvent) => {
      const world = pixiApp.viewport.toWorld(e.global);
      setCoordinates(`${Math.round(world.x)},${Math.round(world.y)}`);
    };
    pixiApp.viewport.on('pointermove', updateCoordinates);
    return () => {
      pixiApp.viewport.off('pointermove', updateCoordinates);
    };
  });
  return <div>{coordinates}</div>;
};
