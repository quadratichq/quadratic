import type { LoaderFunctionArgs } from 'react-router';

import { connectionClient } from '@/shared/api/connectionClient';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { uuid, type } = params;

  try {
    // We don't have precise types here because the connection service just
    // tells us that `type` is a string. But we know this will throw if wrong
    // so this is ok for now.
    // @ts-expect-error
    const data = await connectionClient.schemas.get(type, uuid);
    return { ok: true, data };
  } catch (e) {
    console.error(e);
    return { ok: false };
  }
};
