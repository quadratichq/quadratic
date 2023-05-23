import { PrismaClient, QUser, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const get_file = async (user: QUser, uuid: string) => {
  // Get the file from the database by uuid
  const file = await prisma.qFile.findFirst({
    where: {
      uuid,
    },
  });

  if (!file) return null;
  const gridFile = file.contents as Prisma.JsonObject;

  // only return the file if the user is the owner OR if it's marked as public
  if (user.id === file.qUserId || gridFile.isPublic) {
    return file;
  }

  throw new Error('File owner does not match user request');
};
