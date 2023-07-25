import { useOthers, useUpdatePresence } from '@y-presence/react';
import React, { useEffect } from 'react';
import { UserPresence } from './types';
import { Cursor } from './Cursor';

export default function Room() {
  const others = useOthers<UserPresence>();
  const updatePresence = useUpdatePresence<UserPresence>();

  console.log('others', others);

  const handlePointMove = React.useCallback(
    (e) => {
      //   console.log(e);
      updatePresence({
        cursor: {
          x: e.clientX,
          y: e.clientY,
        },
      });
    },
    [updatePresence]
  );

  const handlePointLeave = React.useCallback(
    (e) => {
      updatePresence({
        cursor: undefined,
      });
    },
    [updatePresence]
  );

  useEffect(() => {
    document.addEventListener('pointermove', handlePointMove);
    document.addEventListener('pointerleave', handlePointLeave);

    return () => {
      document.removeEventListener('pointermove', handlePointMove);
      document.removeEventListener('pointerleave', handlePointLeave);
    };
  }, [handlePointMove, handlePointLeave]);

  return (
    <div>
      <div className="info">Number of connected users: {others.length + 1}</div>

      {others.map((user) => {
        return <Cursor key={user.id} {...user.presence} />;
      })}
    </div>
  );
}
