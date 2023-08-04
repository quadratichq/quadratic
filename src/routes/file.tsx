import { ErrorOutline, QuestionMarkOutlined } from '@mui/icons-material';
import { Button } from '@mui/material';
import apiClientSingleton from 'api-client/apiClientSingleton';
import { GetFileResSchema } from 'api-client/types';
import { Link, LoaderFunctionArgs, isRouteErrorResponse, useLoaderData, useRouteError } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import { GridFile, GridFileSchema } from 'schemas';
import { validateAndUpgradeGridFile } from 'schemas/validateAndUpgradeGridFile';
import Empty from 'shared/Empty';
import QuadraticApp from 'ui/QuadraticApp';

export type InitialFile = {
  name: string;
  contents: GridFile;
};

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<InitialFile> => {
  const { uuid } = params;

  // Ensure we have an UUID that matches the schema
  if (!GetFileResSchema.shape.file.shape.uuid.safeParse(uuid).success) {
    throw new Response('Bad request. Expected a UUID string.', { status: 400 });
  }

  // Fetch the file
  const data = await apiClientSingleton.getFile(uuid as string);
  if (!data) {
    throw new Response('Unexpected response from the API.', { status: 500 });
  }

  // Validate and upgrade file to the latest version
  const contents = validateAndUpgradeGridFile(data.file.contents);
  if (!contents) {
    throw new Response('Invalid file that could not be upgraded.', { status: 400 });
    // TODO sentry...
  }

  // If the file version is newer than what is supported by the current version
  // of the app, do a (hard) reload.
  if (contents.version > GridFileSchema.shape.version.value) {
    // @ts-expect-error
    window.location.reload(true);
  }

  return { contents, name: data.file.name };
};

export const Component = () => {
  const initialFile = useLoaderData() as InitialFile;

  return (
    <RecoilRoot>
      <QuadraticApp initialFile={initialFile} />
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
