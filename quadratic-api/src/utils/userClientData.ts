import { UserClientDataKvSchema, type UserClientDataKv } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../dbClient';

export async function getUserClientDataKv(userId: number | undefined) {
  if (!userId) {
    return undefined;
  }

  const user = await dbClient.user.findUnique({
    where: { id: userId },
    select: { clientDataKv: true },
  });

  if (!user) {
    // TODO: log to sentry, unexpected
    return undefined;
  }

  const parsed = UserClientDataKvSchema.safeParse(user.clientDataKv);
  if (!parsed.success) {
    // TODO: if this failed, we should log it to Sentry because the data has
    // been corrupted somehow and that's unexpected
    return undefined;
  }

  return parsed.data;
}

export async function setUserClientDataKv(userId: number, clientDataKv: UserClientDataKv) {
  const validatedClientDataKv = UserClientDataKvSchema.safeParse(clientDataKv);
  if (!validatedClientDataKv.success) {
    // TODO: if this failed, we should log it to Sentry because the data has
    // been corrupted somehow and that's unexpected
  }

  await dbClient.user.update({
    where: { id: userId },
    data: { clientDataKv: validatedClientDataKv.data },
  });
}
