import { PrismaClient, User, File } from '@prisma/client';

const prisma = new PrismaClient();

interface getFileResult {
  permission: 'OWNER' | 'READONLY' | 'EDIT' | 'NOT_SHARED' | undefined;
  file: File | undefined;
}

export const get_file = async (user: User, uuid: string): Promise<getFileResult> => {
  // Get the file from the database by uuid
  const file = await prisma.file.findFirst({
    where: {
      uuid,
    },
  });

  if (!file)
    return {
      permission: undefined,
      file: undefined,
    };

  // only return the file if the user is the owner
  if (user.id === file.ownerUserId) {
    return {
      permission: 'OWNER',
      file,
    };
  }

  // not the owner, if the file is marked as public, return it with the appropriate permission
  if (file.public_link_access === 'READONLY' || file.public_link_access === 'EDIT') {
    return {
      permission: file.public_link_access,
      file,
    };
  }

  // permission not granted
  return {
    permission: 'NOT_SHARED',
    file: undefined,
  };
};
