import Room from './Room';
import { awareness, provider } from './y';
import { RoomProvider } from '@y-presence/react';
import { useEffect, useState } from 'react';
import { USER_COLORS, USER_NAMES } from './constants';
import { UserPresence } from './types';

const random = (arr: string[]): string => {
  return arr[Math.floor(Math.random() * arr.length)];
};

const name = random(USER_NAMES);
const color = random(USER_COLORS);

export const ColabRoom = () => {
  const [loading, setLoading] = useState(true);

  console.log('loading', loading);

  useEffect(() => {
    const onSync = (isSynced: boolean) => {
      if (isSynced) {
        setLoading(false);
      }
    };

    provider.on('sync', onSync);

    return () => provider.off('sync', onSync);
  }, []);

  return (
    <div>
      <RoomProvider<UserPresence> awareness={awareness} initialPresence={{ name: name, color: color }}>
        <Room />
      </RoomProvider>
    </div>
  );
};
