import { PrismaClient, QUser, Prisma, QFile } from '@prisma/client';

const prisma = new PrismaClient();

interface getFileResult {
  permission: boolean | null;
  file: QFile | null;
}

export const get_file = async (user: QUser, uuid: string): Promise<getFileResult> => {
  // Get the file from the database by uuid
  const file = await prisma.qFile.findFirst({
    where: {
      uuid,
    },
  });

  if (!file)
    return {
      permission: null,
      file: null,
    };
  const gridFile = file.contents as Prisma.JsonObject;

  // only return the file if the user is the owner OR if it's marked as public
  if (user.id === file.qUserId || gridFile.isPublic) {
    return {
      permission: true,
      file,
    };
  }

  return {
    permission: false,
    file: null,
  };
};
