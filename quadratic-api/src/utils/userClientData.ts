import * as Sentry from '@sentry/node';
import { UserClientDataKvSchema } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../dbClient';

export async function getUserClientDataKv(userId: number | undefined) {
  // Expected because an unknown person can request a file that's been shared
  // publicly, in which case we won't have a `userClientDataKv` for them
  if (!userId) {
    return undefined;
  }

  // Lookup the user and find their data
  const user = await dbClient.user.findUnique({
    where: { id: userId },
    select: { clientDataKv: true },
  });
  if (!user) {
    Sentry.captureEvent({
      message: 'A user known by the auth service couldn’t be found in our database.',
      level: 'error',
      extra: {
        userId,
      },
    });
    return undefined;
  }

  // Ensure the that the data in the db matches our expected schema
  const parsed = UserClientDataKvSchema.safeParse(user.clientDataKv);
  if (!parsed.success) {
    Sentry.captureEvent({
      message: 'The `userClientDataKv` in the database has become corrupted for a known user.',
      level: 'error',
      extra: {
        userId,
      },
    });
    return undefined;
  }

  // Everything looks good, return the data
  return parsed.data;
}
