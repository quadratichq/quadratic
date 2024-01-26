import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { multiplayer } from '@/multiplayer/multiplayer';
import { MultiplayerUser } from '@/multiplayer/multiplayerTypes';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

export const useMultiplayerUsers = (): { users: MultiplayerUser[]; followers: string[] } => {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);

  const [users, setUsers] = useState<MultiplayerUser[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);

  useEffect(() => {
    const users = multiplayer.getUsers();
    setUsers(users);
    setFollowers(users.filter((user) => user.follow === multiplayer.sessionId).map((user) => user.session_id));
    const handleUpdate = (e: any) => setUsers(e.detail);
    window.addEventListener('multiplayer-update', handleUpdate);
    return () => window.removeEventListener('multiplayer-update', handleUpdate);
  }, [editorInteractionState.follow]);

  return { users, followers };
};
