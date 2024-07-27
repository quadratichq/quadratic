import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import type { MultiplayerUser } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';

export const useMultiplayerUsers = (): { users: MultiplayerUser[]; followers: string[] } => {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);

  const [users, setUsers] = useState<MultiplayerUser[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);

  useEffect(() => {
    const updateFollowers = () => {
      setFollowers(users.filter((user) => user.follow === multiplayer.sessionId).map((user) => user.session_id));
    };
    events.on('multiplayerFollow', updateFollowers);
    return () => {
      events.off('multiplayerFollow', updateFollowers);
    };
  });

  useEffect(() => {
    const users = multiplayer.getUsers();
    setUsers(users.sort((a, b) => a.index - b.index));
    setFollowers(users.filter((user) => user.follow === multiplayer.sessionId).map((user) => user.session_id));

    const handleUpdate = (users: MultiplayerUser[]) => setUsers(users.sort((a, b) => a.index - b.index));
    events.on('multiplayerUpdate', handleUpdate);
    return () => {
      events.off('multiplayerUpdate', handleUpdate);
    };
  }, [editorInteractionState.follow]);

  return { users, followers };
};
