import { connectionClient } from '@/shared/api/connectionClient';
import { LoaderFunctionArgs } from 'react-router';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { uuid, type } = params;

  try {
    // @ts-expect-error
    const data = await connectionClient.schemas.get(type, uuid);
    return { ok: true, data };
  } catch (e) {
    console.error(e);
    return { ok: false };
  }
};
