import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { multiplayer } from '@/multiplayer/multiplayer';
import { MultiplayerUser } from '@/multiplayer/multiplayerTypes';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

export const useMultiplayerUsers = (): { users: MultiplayerUser[]; follow?: MultiplayerUser } => {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);

  const [users, setUsers] = useState<MultiplayerUser[]>([]);
  const [follow, setFollow] = useState<MultiplayerUser | undefined>(undefined);

  useEffect(() => {
    const users = multiplayer.getUsers();
    setUsers(users);
    if (editorInteractionState.follow) {
      setFollow(users.find((user) => user.session_id === editorInteractionState.follow));
    } else {
      setFollow(undefined);
    }
    const handleUpdate = (e: any) => setUsers(e.detail);
    window.addEventListener('multiplayer-update', handleUpdate);
    return () => window.removeEventListener('multiplayer-update', handleUpdate);
  }, [editorInteractionState.follow]);

  return { users, follow };
};
