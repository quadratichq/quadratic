import dbClient from '../dbClient';

export async function getUserIdByAuth0Id(id: string) {
  const user = await dbClient.user.findFirst({
    where: {
      auth0Id: id,
    },
  });
  if (!user) throw new Error('[Testing] User not found');
  return user.id;
}

/**
 * When a 4xx or 5xx error is returned, expect a standard format
 */
export function expectError(req: any) {
  expect(req).toHaveProperty('body');
  expect(req.body).toHaveProperty('error');
  expect(req.body.error).toHaveProperty('message');
  expect(typeof req.body.error.message).toBe('string');
}
