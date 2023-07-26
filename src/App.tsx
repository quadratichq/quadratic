import './styles.css';
import { QuadraticApp } from './ui/QuadraticApp';
import { RecoilRoot } from 'recoil';
import { Link, LoaderFunctionArgs, isRouteErrorResponse, useLoaderData, useRouteError } from 'react-router-dom';
import Empty from './dashboard/Empty';
import { ErrorOutline, QuestionMarkOutlined } from '@mui/icons-material';
import { Button } from '@mui/material';
import apiClientSingleton from './api-client/apiClientSingleton';
import { GetFileClientRes } from './api-client/types';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { uuid } = params;

  // Ensure we have an ID that matches the schema
  if (!(uuid /*&& IdSchema.safeParse(uuid).success*/)) {
    throw new Response('Bad request. Expected a UUID string.', { status: 400 });
  }

  // Fetch the file
  const data = await apiClientSingleton.getFile(uuid as string);
  if (!data) {
    throw new Response('Unexpected response from the API.');
  }

  // TODO permissions

  return data;
};

export const Component = () => {
  const data = useLoaderData() as GetFileClientRes;

  return (
    <RecoilRoot>
      <QuadraticApp fileFromServer={data} />
    </RecoilRoot>
  );
};

// TODO catch 404, don't have permission for file, generic error
export const ErrorBoundary = () => {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    console.error(error.data);
    // TODO differentiate between different kind of file loading errors?
    // e.g. file came in but didn't validate. file couldn't be found. file...
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
