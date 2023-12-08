import { multiplayer } from '@/multiplayer/multiplayer';
import { useEffect, useState } from 'react';

// this is needed since we extend the user object with the color (and pair it down since we don't need everything)
export interface SimpleMultiplayerUser {
  sessionId: string;

  // todo: use the userId to tie the same user together somehow in the UI
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  picture: string;
  color: number;
}

export const useMultiplayerUsers = (): SimpleMultiplayerUser[] => {
  const [users, setUsers] = useState<SimpleMultiplayerUser[]>([]);

  useEffect(() => {
    setUsers(multiplayer.getUsers());
    const handleUpdate = (e: any) => setUsers(e.detail);
    window.addEventListener('multiplayer-update', handleUpdate);
    return () => window.removeEventListener('multiplayer-update', handleUpdate);
  }, []);

  return users;
};
