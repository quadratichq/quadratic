import { UserClientDataKvSchema } from 'quadratic-shared/typesAndSchemas';
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
