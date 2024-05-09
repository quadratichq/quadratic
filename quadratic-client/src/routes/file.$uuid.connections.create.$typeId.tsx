import { ConnectionDialogBody } from '@/app/ui/connections/ConnectionDialogBody';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ActionFunctionArgs, redirect } from 'react-router-dom';

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const data: ApiTypes['/v0/connections.POST.request'] = await request.json();
  // await new Promise((resolve) => setTimeout(resolve, 5000));
  await apiClient.connections.create(data);
  // TODO if it completes, redirect to connections list, otherwise show error
  return redirect(ROUTES.FILE_CONNECTIONS(params?.uuid as string));
  // return redirect(checkoutSessionUrl.url);
};

export const Component = () => {
  // const { typeId } = useParams() as { uuid: string; typeId: string };

  return <ConnectionDialogBody typeId={'POSTGRES'} />;
};
