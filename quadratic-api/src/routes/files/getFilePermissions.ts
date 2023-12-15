import { File, User } from '@prisma/client';

export type FILE_PERMISSION = 'OWNER' | 'VIEWER' | 'EDITOR' | 'ANONYMOUS';

export const getFilePermissions = (user: User | undefined, file: File): FILE_PERMISSION => {
  if (!user) {
    return 'ANONYMOUS';
  }

  if (file.ownerUserId === user?.id) {
    return 'OWNER';
  }

  if (file.publicLinkAccess === 'READONLY') {
    return 'VIEWER';
  }

  if (file.publicLinkAccess === 'EDIT') {
    return 'EDITOR';
  }

  // If we reach here, something happened we didn't expect so we'll return
  // the lowest permission level
  return 'ANONYMOUS';
};
