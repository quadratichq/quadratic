import { Avatar, AvatarGroup, Tooltip } from '@mui/material';
import { useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import { RootLoaderData } from '../Routes';
import { Cursor } from './Cursor';
import { USER_COLORS } from './constants';
import { UserPresence } from './types';
import { awareness } from './y';

const random = (arr: string[]): string => {
  return arr[Math.floor(Math.random() * arr.length)];
};

const color = random(USER_COLORS);

export const MultiplayerRoom = () => {
  // const [loading, setLoading] = useState(true);
  const [others, setOthers] = useState<UserPresence[]>([]);
  const { user } = useRouteLoaderData('root') as RootLoaderData;

  useEffect(() => {
    awareness.on('change', (changes: any) => {
      // // The new awareness state changes
      // changes;

      let otherUsers = [] as UserPresence[];
      awareness.getStates().forEach((value, key) => {
        if (value !== undefined) {
          if (key !== awareness.clientID) otherUsers.push(value as UserPresence);
        }
      });

      setOthers(otherUsers);
    });
  }, []);

  useEffect(() => {
    const handlePointMove = (e: PointerEvent) => {
      //   console.log(e);
      awareness.setLocalState({
        cursor: {
          x: e.pageX,
          y: e.pageY,
        },
        name: user?.name,
        email: user?.email,
        color,
      } as UserPresence);
    };

    const handlePointLeave = (e: PointerEvent) => {
      awareness.setLocalState({
        cursor: undefined,
        name: user?.name,
        email: user?.email,
        color,
      } as UserPresence);
    };

    document.addEventListener('pointermove', handlePointMove);
    document.addEventListener('pointerleave', handlePointLeave);

    return () => {
      document.removeEventListener('pointermove', handlePointMove);
      document.removeEventListener('pointerleave', handlePointLeave);
    };
  }, []);

  return (
    <div>
      <AvatarGroup max={4}>
        {others.map((user, i) => {
          return (
            <Tooltip
              key={i}
              title={user.email}
              sx={{
                bgcolor: user.color,
              }}
            >
              <Avatar
                key={i}
                sx={{
                  width: 24,
                  height: 24,
                  fontSize: '0.8rem',
                  backgroundColor: user.color,
                }}
                variant="rounded"
              ></Avatar>
            </Tooltip>
          );
        })}
      </AvatarGroup>
      {others.map((user, i) => {
        return <Cursor key={i} {...user} />;
      })}
    </div>
  );
};
