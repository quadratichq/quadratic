import { CheckCircleOutlineOutlined, ErrorOutline } from '@mui/icons-material';
import { Box, Button, Chip, CircularProgress, Stack, Typography, useTheme } from '@mui/material';
import * as Sentry from '@sentry/react';
import localforage from 'localforage';
import mixpanel from 'mixpanel-browser';
import { useEffect, useRef, useState } from 'react';
import { redirect, useLoaderData, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { SUPPORT_EMAIL } from '../constants/appConstants';
import { validateAndUpgradeGridFile } from '../schemas/validateAndUpgradeGridFile';
import QuadraticLogo from './components/quadratic-logo.svg';
const LOCAL_FILES_KEY = 'file-list';

type Progress = 'uploading' | 'success' | 'fail';

export type LocalFile = {
  filename: string;
  id: string;
  modified: number;
  // This key wasn't on the file before the migration, so it's values are:
  //   undefined - this file hasn't been touched by any migration
  //   "v1-success" - this file successfully migrated in the v1 migration
  //   "v1-fail" - this file failed to upload in the v1 migration
  //
  // And there's room for future migrations enumerations as necessary, e.g.
  //   "v2-success"
  //   "v2-fail"
  migrationStatus?: 'v1-success' | 'v1-fail';
};

const getLocalFiles = async () => {
  localforage.config({ name: 'Quadratic', version: 1 });
  const localFiles: LocalFile[] = (await localforage.getItem(LOCAL_FILES_KEY)) || [];
  return localFiles;
};

const getLocalFilesNotYetMigrated = async () => {
  const localFiles = await getLocalFiles();
  const localFilesNotYetMigrated = localFiles.filter(({ migrationStatus }) => migrationStatus === undefined);
  return localFilesNotYetMigrated;
};

export const needsMigration = async () => {
  const files = await getLocalFilesNotYetMigrated();
  return Boolean(files.length);
};

export const loader = async (): Promise<LocalFile[] | Response> => {
  // We test if a migration is necessary on this page (its possible, but
  // unlikely, somebody hit this page directly, rather than being redirected).
  // If a migration isn't necessary, we just redirect to home.
  if (!(await needsMigration())) {
    return redirect('/');
  }

  document.title = 'Cloud files migration - Quadratic';

  const localFiles = await getLocalFilesNotYetMigrated();
  return localFiles;
};

export const Component = () => {
  const localFilesToUpload = useLoaderData() as LocalFile[];
  const [numOfFilesToUpload, setNumOfFilesToUpload] = useState<number>(localFilesToUpload.length);
  const [progress, setProgress] = useState<Progress>('uploading');
  const navigate = useNavigate();
  const isMounted = useRef<boolean>(false);
  const theme = useTheme();

  const handleClick = () => {
    navigate('/', { replace: true });
  };

  useEffect(() => {
    if (isMounted?.current) return;
    isMounted.current = true;

    mixpanel.track('[CloudFilesMigration].started', {
      countOfFilesToUpload: localFilesToUpload.length,
    });

    const syncFilesToCloud = async () => {
      let fileIdsThatFailed: string[] = [];
      for (const localFile of localFilesToUpload) {
        try {
          // Get the local file
          const oldFile = await localforage.getItem(localFile.id);

          // Validate and upgrade it to the latest version
          const newFile = await validateAndUpgradeGridFile(JSON.stringify(oldFile));
          if (!newFile) {
            Sentry.captureEvent({
              message: `Failed to validate and upgrade user file from database. It will likely have to be fixed manually. File name ${localFile.filename}, File ID: ${localFile.id}`,
              level: 'error',
            });
            throw new Response('Invalid file that could not be upgraded.');
          }

          // Create a new file in the DB
          await apiClient.files.create({
            name: localFile.filename,
            contents: newFile.contents,
            version: newFile.version,
          });

          // If it reaches here, we’re good!
        } catch (e) {
          console.error(e);
          fileIdsThatFailed.push(localFile.id);
        }

        // Update the file list with the migration status of the current file
        const oldFileList = (await localforage.getItem(LOCAL_FILES_KEY)) as LocalFile[];
        const newFileList = oldFileList.map((item) => ({
          ...item,
          migrationStatus: fileIdsThatFailed.includes(item.id) ? 'v1-fail' : 'v1-success',
        }));
        await localforage.setItem(LOCAL_FILES_KEY, newFileList);

        // Update the UI state for the number of files we have left
        setNumOfFilesToUpload((old) => old - 1);
      }

      // Log details of migration to sentry and mixpanel
      if (fileIdsThatFailed.length) {
        mixpanel.track('[CloudFilesMigration].failure', {
          fileIdsThatFailed: fileIdsThatFailed,
          count: fileIdsThatFailed.length,
        });
        Sentry.captureEvent({
          message: 'Cloud files migration failed to upload some local file(s).',
          level: 'error',
          extra: {
            fileIdsThatFailed,
          },
        });
      } else {
        mixpanel.track('[CloudFilesMigration].success');
      }

      // Once all files tried to upload, we set the final state for the UI
      setProgress(fileIdsThatFailed.length === 0 ? 'success' : 'fail');
    };
    syncFilesToCloud();
  }, [localFilesToUpload]);

  return (
    <Stack
      sx={{
        alignContent: 'center',
        alignItems: 'center',
        gap: theme.spacing(3),
        px: theme.spacing(1),
        py: theme.spacing(5),
        maxWidth: '30rem',
        mx: 'auto',
        textAlign: 'center',
      }}
    >
      <img src={QuadraticLogo} width="53" height="80" alt="Quadratic logo" />
      <Stack gap={theme.spacing(1)} mb={theme.spacing(1)}>
        <Typography variant="h5" color="text.primary">
          Cloud storage is here
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Please wait while files stored in your browser are uploaded to your Quadratic account so you can access them
          anywhere.
        </Typography>
      </Stack>

      {progress === 'uploading' && (
        <Chip
          icon={<CircularProgress size={24} color="primary" />}
          label={`Uploading ${numOfFilesToUpload} file${numOfFilesToUpload === 1 ? '' : 's'}…`}
          variant="outlined"
        />
      )}
      {progress === 'success' && (
        <Stack gap={theme.spacing(3)}>
          <Box>
            <Chip icon={<CheckCircleOutlineOutlined />} label="Migration complete" variant="outlined" color="success" />
          </Box>
          <Box>
            <Button onClick={handleClick} variant="contained" disableElevation>
              Continue to app
            </Button>
          </Box>
        </Stack>
      )}
      {progress === 'fail' && (
        <Stack gap={theme.spacing(3)}>
          <Stack gap={theme.spacing(1)}>
            <Box>
              <Chip icon={<ErrorOutline />} label="Migration failed" variant="outlined" color="error" />
            </Box>
            <Typography color={theme.palette.error.main} variant="body2">
              Something went wrong uploading some of the files in your browser. Contact us if you want help migrating
              these old files: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </Typography>
          </Stack>
          <Box>
            <Button onClick={handleClick} variant="contained" disableElevation>
              Continue to app
            </Button>
          </Box>
        </Stack>
      )}
    </Stack>
  );
};
