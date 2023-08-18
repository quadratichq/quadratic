import { ErrorOutline, QuestionMarkOutlined } from '@mui/icons-material';
import { Button } from '@mui/material';
import * as Sentry from '@sentry/react';
import init, { hello } from 'quadratic-core';
import { Link, LoaderFunctionArgs, isRouteErrorResponse, useLoaderData, useRouteError } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import { apiClient } from '../api/apiClient';
import { GetFileResSchema } from '../api/types';
import { Empty } from '../components/Empty';
import { SheetController } from '../grid/controller/sheetController';
import { loadAssets } from '../gridGL/loadAssets';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { GridFile, GridFileSchema } from '../schemas';
import { validateAndUpgradeGridFile } from '../schemas/validateAndUpgradeGridFile';
import QuadraticApp from '../ui/QuadraticApp';
import { webWorkers } from '../web-workers/webWorkers';

export type InitialFile = {
  name: string;
  contents: GridFile;
  sheetController: SheetController;
  app: PixiApp;
};

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<InitialFile> => {
  const { uuid } = params;

  // Ensure we have an UUID that matches the schema
  if (!GetFileResSchema.shape.file.shape.uuid.safeParse(uuid).success) {
    throw new Response('Bad request. Expected a UUID string.', { status: 400 });
  }

  // Fetch the file
  const data = await apiClient.getFile(uuid as string);

  // Validate and upgrade file to the latest version
  const contents = validateAndUpgradeGridFile(data.file.contents);
  if (!contents) {
    Sentry.captureEvent({
      message: `Failed to validate and upgrade user file from database. It will likely have to be fixed manually. File UUID: ${uuid}`,
      level: Sentry.Severity.Critical,
    });
    throw new Response('Invalid file that could not be upgraded.', { status: 400 });
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

  // create pixi app
  const sheetController = new SheetController();
  const app = new PixiApp(sheetController);

  // populate web workers
  webWorkers.init(app);

  await loadAssets();
  await init();
  hello(); // let Rust say hello to console

  return { contents, name: data.file.name, sheetController, app };
};

export const Component = () => {
  const initialFile = useLoaderData() as InitialFile;

  return (
    <RecoilRoot>
      <QuadraticApp initialFile={initialFile} />
    </RecoilRoot>
  );
};

export const ErrorBoundary = () => {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    console.error(error.data);
    // If the future, we can differentiate between the different kinds of file
    // loading errors and be as granular in the message as we like.
    // e.g. file found but didn't validate. file couldn't be found. file...
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
