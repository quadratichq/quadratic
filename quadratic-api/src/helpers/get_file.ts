import { PrismaClient, QUser } from '@prisma/client';

const prisma = new PrismaClient();

export const get_file = async (user: QUser, uuid: string) => {
  // Get the file from the database, only if it exists and the user owns it
  return await prisma.qFile.findFirst({
    where: {
      qUserId: user.id, // important to prevent users from getting access to files they don't own
      uuid,
    },
  });
};
