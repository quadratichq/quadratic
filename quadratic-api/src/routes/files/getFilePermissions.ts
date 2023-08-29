import { File, User } from '@prisma/client';

export type FILE_PERMISSION = 'OWNER' | 'VIEWER' | 'EDITOR';

export const getFilePermissions = (user: User | undefined, file: File): FILE_PERMISSION => {
  if (file.ownerUserId === user?.id) {
    return 'OWNER';
  }

  if (file.public_link_access === 'READONLY') {
    return 'VIEWER';
  }

  if (file.public_link_access === 'EDIT') {
    return 'EDITOR';
  }
};
