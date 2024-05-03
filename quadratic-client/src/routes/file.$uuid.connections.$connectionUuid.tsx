import { ConnectionDialog } from '@/app/ui/components/ConnectionDialog';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect, useLoaderData } from 'react-router-dom';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { connectionUuid } = params as { uuid: string; connectionUuid: string };
  console.log('cionnect loader', connectionUuid);
  const connection = await apiClient.connections.get(connectionUuid);
  console.log('cionnect', connection);
  return connection;
};

type Action = UpdateConnectionAction | DeleteConnectionAction;

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { uuid, connectionUuid } = params as { uuid: string; connectionUuid: string };
  const data: Action = await request.json();

  if (data._intent === 'update-connection') {
    const { _intent, ...body } = data;
    // TODO: fix type issue
    await apiClient.connections.update(connectionUuid, body as ApiTypes['/v0/connections/:uuid.PUT.request']);
    return redirect(ROUTES.FILE_CONNECTIONS(uuid));
  }

  if (data._intent === 'delete-connection') {
    await apiClient.connections.delete(connectionUuid);
    return redirect(ROUTES.FILE_CONNECTIONS(uuid));
  }

  return { ok: false };
};

type UpdateConnectionAction = ReturnType<typeof getUpdateConnectionAction>;
export const getUpdateConnectionAction = (uuid: string, body: ApiTypes['/v0/connections/:uuid.PUT.request']) => {
  return {
    _intent: 'update-connection',
    ...body,
  };
};

type DeleteConnectionAction = ReturnType<typeof getDeleteConnectionAction>;
export const getDeleteConnectionAction = (uuid: string) => {
  return {
    _intent: 'delete-connection',
  };
};

export const Component = () => {
  const initialData = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  console.log('/connections/:uuid', initialData);
  return <ConnectionDialog typeId={'postgres'} initialData={initialData} />;
};

// TODO: (connections) make some nice error boundary routes for the dialog

/*
        <form
          id="create-connection"
          method="POST"
          ref={formRef}
          onChange={() => {
            setConnectionState('idle');
          }}
          onSubmit={onSubmit}
          className="grid gap-4"
        >
          <PostgresBody />
          <div
            className={cn(
              'flex items-center rounded border-2 px-2 py-2 pl-3',
              connectionState === 'idle' && 'border-border',
              connectionState === 'success' && 'border-success',
              connectionState === 'error' && 'border-destructive'
            )}
          >
            <div className="flex items-center gap-2">
              {connectionState === 'idle' && (
                <>
                  <InfoCircledIcon className="text-muted-foreground" />
                  <Type>Connection must be tested</Type>
                </>
              )}
              {connectionState === 'loading' && (
                <>
                  <CircularProgress style={{ width: 15, height: 15 }} />
                  <Type>Testing…</Type>
                </>
              )}
              {connectionState === 'success' && (
                <>
                  <CheckCircledIcon className="text-success" />
                  <Type>Connection ok!</Type>
                </>
              )}
              {connectionState === 'error' && (
                <>
                  <ExclamationTriangleIcon className="text-destructive" />
                  <Type>Connection failed. Adjust details and try again.</Type>
                </>
              )}
            </div>

            <Button
              type="button"
              className="ml-auto"
              variant="secondary"
              disabled={false}
              onClick={async () => {
                setConnectionState((prev) =>
                  prev === 'idle' ? 'loading' : prev === 'loading' ? 'success' : prev === 'success' ? 'error' : 'idle'
                );

                // await new Promise((resolve) => setTimeout(resolve, 3000));

                // const response = await apiClient.createConnection(formData as ApiTypes['/v0/connections.POST.request']); // TODO: typecasting here is unsafe
                // console.log('response:', response);
                // const data = await apiClient.runConnection(response.uuid, {
                //   query: `
                //   SELECT
                //       datname AS database_name,
                //       pg_get_userbyid(datdba) AS owner,
                //       pg_database.datistemplate,
                //       pg_database.datallowconn,
                //       datacl
                //   FROM
                //       pg_database
                //   LEFT JOIN
                //       pg_namespace ON datname = nspname;`,
                // });
                // console.log('data:', data);

                // setConnectionState('success');
              }}
            >
              <PlayIcon className="mr-1" /> Test
            </Button>
          </div>
            </form>*/
