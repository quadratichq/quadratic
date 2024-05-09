import { ConnectionDialogBody } from '@/app/ui/connections/ConnectionDialogBody';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ConnectionTypesSchema } from 'quadratic-shared/typesAndSchemasConnections';
import {
  ActionFunctionArgs,
  Link,
  LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useParams,
  useRouteError,
} from 'react-router-dom';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  // Validate that the connection type is one we know about
  const connectionType = ConnectionTypesSchema.parse(params?.connectionType?.toUpperCase());
  return { connectionType };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const data: ApiTypes['/v0/connections.POST.request'] = await request.json();
  // await new Promise((resolve) => setTimeout(resolve, 5000));
  await apiClient.connections.create(data);
  // TODO if it completes, redirect to connections list, otherwise show error
  return redirect(ROUTES.FILE_CONNECTIONS(params?.uuid as string));
  // return redirect(checkoutSessionUrl.url);
};

export const Component = () => {
  const { connectionType } = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  return <ConnectionDialogBody connectionType={connectionType} />;
};

export const ErrorBoundary = () => {
  const { uuid } = useParams() as { uuid: string };
  const error = useRouteError();
  console.error(error);

  return (
    <p className="text-center text-sm text-destructive">
      <strong>Something went wrong</strong>
      <br />
      It looks like you tried to create a connection that doesn’t exist.
      <br />
      <Link to={ROUTES.FILE_CONNECTIONS(uuid)} className="underline">
        Back to connections
      </Link>
    </p>
  );
};
