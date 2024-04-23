import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ActionFunctionArgs, LoaderFunctionArgs, SubmitOptions } from 'react-router-dom';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return null;
};

type Action = {
  response: { ok: boolean } | null;
  request: UpdateEducationActionData;
};

export const action = async ({ params, request }: ActionFunctionArgs): Promise<Action['response']> => {
  const json: Action['request'] = await request.json();
  const { action } = json;

  if (action === 'update-edu-status') {
    try {
      const { email } = json as UpdateEducationActionData;
      await apiClient.education.update({ email });
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  return null;
};

type UpdateEducationActionData = ReturnType<typeof getUpdateEducationAction>['data'];
export function getUpdateEducationAction({ email }: ApiTypes['/v0/education.POST.request']) {
  const options: SubmitOptions = {
    method: 'POST',
    action: ROUTES.EDUCATION,
    encType: 'application/json',
  };
  const data = {
    action: 'update-edu-status',
    email,
  };
  return { data, options };
}
