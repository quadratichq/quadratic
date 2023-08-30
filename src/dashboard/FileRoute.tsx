import { ErrorOutline, QuestionMarkOutlined } from '@mui/icons-material';
import { Button } from '@mui/material';
import * as Sentry from '@sentry/react';
import { Link, LoaderFunctionArgs, isRouteErrorResponse, useRouteError, useRouteLoaderData } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import { apiClient } from '../api/apiClient';
import { ApiTypes, apiSchemas } from '../api/types';
import { Empty } from '../components/Empty';
import { ROUTE_LOADER_IDS } from '../constants/routes';
import { GridFile, GridFileSchema } from '../schemas';
import { validateAndUpgradeGridFile } from '../schemas/validateAndUpgradeGridFile';
import QuadraticApp from '../ui/QuadraticApp';

export type FileData = {
  name: string;
  contents: GridFile;
  permission: ApiTypes['/v0/files/:uuid.GET.response']['permission'];
  sharing: ApiTypes['/v0/files/:uuid/sharing.GET.response'];
};

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<FileData> => {
  const { uuid } = params as { uuid: string };

  // Ensure we have an UUID that matches the schema
  if (!apiSchemas['/v0/files/:uuid.GET.response'].shape.file.shape.uuid.safeParse(uuid).success) {
    throw new Response('Bad request. Expected a UUID string.');
  }

  // Fetch the file
  const data = await apiClient.getFile(uuid).catch((e) => {
    console.error(e);
    return undefined;
  });
  if (!data) {
    throw new Response('Failed to retrive file from server');
  }

  // Validate and upgrade file to the latest version
  const contents = validateAndUpgradeGridFile(data.file.contents);
  if (!contents) {
    Sentry.captureEvent({
      message: `Failed to validate and upgrade user file from database. It will likely have to be fixed manually. File UUID: ${uuid}`,
      level: Sentry.Severity.Critical,
    });
    throw new Response('Invalid file that could not be upgraded.');
  }

  // If the file version is newer than what is supported by the current version
  // of the app, do a (hard) reload.
  if (contents.version > GridFileSchema.shape.version.value) {
    Sentry.captureEvent({
      message: `User opened a file at version ${contents.version} but the app is at version ${GridFileSchema.shape.version.value}. The app will automatically reload.`,
      level: Sentry.Severity.Log,
    });
    // @ts-expect-error hard reload via `true` only works in some browsers
    window.location.reload(true);
  }

  // Fetch the file's sharing info
  const sharing = await apiClient.getFileSharing(uuid).catch((e) => {
    console.error(e);
    return undefined;
  });
  if (!sharing) {
    throw new Error('Failed to retrieve file sharing info from the server.');
  }

  return {
    contents,
    name: data.file.name,
    permission: data.permission,
    sharing,
  };
};

export const Component = () => {
  return (
    <RecoilRoot>
      <QuadraticApp />
    </RecoilRoot>
  );
};

export const ErrorBoundary = () => {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    console.error(error);
    // If the future, we can differentiate between the different kinds of file
    // loading errors and be as granular in the message as we like.
    // e.g. file found but didn't validate. file couldn't be found on server, etc.
    // But for now, we'll just show a 404
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

  // Maybe we log this to Sentry someday...
  console.error(error);
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

export const useFileRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.FILE) as FileData;
