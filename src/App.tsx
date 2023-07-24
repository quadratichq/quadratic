import './styles.css';
import { QuadraticApp } from './ui/QuadraticApp';
import { RecoilRoot } from 'recoil';
import { Link, LoaderFunctionArgs, isRouteErrorResponse, useLoaderData, useRouteError } from 'react-router-dom';
import { GridFile } from './schemas';
import Empty from './dashboard/Empty';
import { ErrorOutline, QuestionMarkOutlined } from '@mui/icons-material';
import { Button } from '@mui/material';
import apiClientSingleton from './api-client/apiClientSingleton';

type LoaderData = {
  file: GridFile;
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { uuid } = params;

  // Ensure we have an ID that matches the schema
  if (!(uuid /*&& IdSchema.safeParse(uuid).success*/)) {
    throw new Response('Bad request. Expected a UUID string.', { status: 400 });
  }

  // Fetch the file
  const file = await apiClientSingleton.getFile(uuid as string);
  if (!file) {
    throw new Response('Unexpected response from the API.');
  }

  // Parse resonse and make sure it's valid (should we do this in apiClient)

  // TODO if file isn't valid

  console.log(file);
  // await fetch('/examples/default.grid')
  //   .then((res) => {
  //     if (!res.ok) {
  //       throw new Error('Failed to fetch');
  //     }
  //     return res.json();
  //   })
  //   .then((file) => {
  //     // TODO validate and upgrade file as necessary before passing into the app
  //     return {
  //       ...file,
  //       filename: 'Deafult (example)',
  //       id: uuid(),
  //       modified: Date.now(),
  //     };
  //   });
  return { file };
};

export const Component = () => {
  const { file } = useLoaderData() as LoaderData;

  return (
    <RecoilRoot>
      <QuadraticApp fileFromServer={file} />
    </RecoilRoot>
  );
};

// TODO catch 404, don't have permission for file, generic error
export const ErrorBoundary = () => {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    console.error(error.data);
    return (
      <Empty
        title="404: file not found"
        description="This file may have been deleted, moved, or made unavailable. Try reaching out to the file owner."
        Icon={QuestionMarkOutlined}
        actions={
          <Button variant="contained" disableElevation component={Link} to="/">
            Go home
          </Button>
        }
      />
    );
  }

  // TODO log this case to sentry
  console.log(error);
  return (
    <Empty
      title="Unexpected error"
      description="Something went wrong loading this file. If the error continues, contact us."
      Icon={ErrorOutline}
      actions={
        <Button variant="contained" disableElevation component={Link} to="/">
          Go home
        </Button>
      }
      severity="error"
    />
  );
};
