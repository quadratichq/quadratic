import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { MultiplayerUser } from '@/web-workers/multiplayerWebWorker/multiplayerTypes';
import { multiplayer } from '@/web-workers/multiplayerWebWorker/multiplayer';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

export const useMultiplayerUsers = (): { users: MultiplayerUser[]; followers: string[] } => {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);

  const [users, setUsers] = useState<MultiplayerUser[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);

  useEffect(() => {
    const updateFollowers = () => {
      setFollowers(users.filter((user) => user.follow === multiplayer.sessionId).map((user) => user.session_id));
    };
    window.addEventListener('multiplayer-follow', updateFollowers);
    return () => window.removeEventListener('multiplayer-follow', updateFollowers);
  });

  useEffect(() => {
    const users = multiplayer.getUsers();
    setUsers(users.sort((a, b) => a.index - b.index));
    setFollowers(users.filter((user) => user.follow === multiplayer.sessionId).map((user) => user.session_id));

    const handleUpdate = (e: any) => {
      const users = e.detail as MultiplayerUser[];
      setUsers(users.sort((a, b) => a.index - b.index));
    };
    window.addEventListener('multiplayer-update', handleUpdate);

    return () => window.removeEventListener('multiplayer-update', handleUpdate);
  }, [editorInteractionState.follow]);

  return { users, followers };
};
