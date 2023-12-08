import { multiplayer } from '@/multiplayer/multiplayer';
import { MultiplayerUser } from '@/multiplayer/multiplayerTypes';
import { useEffect, useState } from 'react';

export const useMultiplayerUsers = (): MultiplayerUser[] => {
  const [users, setUsers] = useState<MultiplayerUser[]>([]);

  useEffect(() => {
    setUsers(multiplayer.getUsers());
    const handleUpdate = (e: any) => setUsers(e.detail);
    window.addEventListener('multiplayer-update', handleUpdate);
    return () => window.removeEventListener('multiplayer-update', handleUpdate);
  }, []);

  return users;
};
