import { getFileType, stripExtension, supportedFileTypes, uploadFile } from '@/app/helpers/files';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { FileImportProgress } from '@/dashboard/atoms/filesImportProgressAtom';
import { filesImportProgressAtom } from '@/dashboard/atoms/filesImportProgressAtom';
import { filesImportProgressListAtom } from '@/dashboard/atoms/filesImportProgressListAtom';
import { apiClient } from '@/shared/api/apiClient';
import { ApiError } from '@/shared/api/fetchFromApi';

import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { sendAnalyticsError } from '@/shared/utils/error';
import { Buffer } from 'buffer';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useSetRecoilState } from 'recoil';

const fileImportSendAnalyticsError = (from: string, error: Error | unknown) => {
  sendAnalyticsError('useFileImport', from, error);
};

interface FileImportProps {
  files?: File[];
  sheetId?: string;
  insertAt?: JsCoordinate;
  cursor?: string;
  isPrivate?: boolean;
  teamUuid?: string;
  folderUuid?: string;
  isOverwrite?: boolean;
}

export function useFileImport(): (props: FileImportProps) => Promise<void> {
  const setFilesImportProgressState = useSetRecoilState(filesImportProgressAtom);
  const setFilesImportProgressListState = useSetRecoilState(filesImportProgressListAtom);

  const { addGlobalSnackbar } = useGlobalSnackbar();

  const location = useLocation();
  const navigate = useNavigate();

  const doImport = useCallback(
    async ({
      files,
      sheetId,
      insertAt,
      cursor,
      isPrivate = true,
      teamUuid,
      folderUuid,
      isOverwrite,
    }: FileImportProps) => {
      quadraticCore.initWorker();

      if (!files) files = await uploadFile(supportedFileTypes);
      if (files.length === 0) {
        return;
      }

      const firstFileType = getFileType(files[0]);
      const createNewFile =
        cursor === undefined && sheetId === undefined && insertAt === undefined && teamUuid !== undefined;
      const openImportedFile = createNewFile && files.length === 1;
      const userOnTeamsPage = location.pathname.includes('/teams/');
      if (userOnTeamsPage) {
        setFilesImportProgressListState(() => ({ show: true }));
      }

      trackEvent('[ImportData].useFileImport', {
        files: files.map((file) => ({
          type: getFileType(file),
          size: file.size,
        })),
        location: createNewFile ? 'Dashboard' : 'In sheet',
      });

      if (!createNewFile && firstFileType === 'Grid') {
        addGlobalSnackbar(`Error importing ${files[0].name}: Cannot import grid file into existing file`, {
          severity: 'warning',
        });
        files = [];
        return;
      }

      // Only one file can be imported at a time (except for excel), inside a existing file
      if (!createNewFile && files.length > 1) {
        if (firstFileType === 'Excel') {
          // importing into a existing file, use only excel files
          files = files.filter((file) => {
            if (getFileType(file) === 'Excel') {
              return true;
            } else {
              addGlobalSnackbar(`Error importing ${file.name}: Cannot import multiple types files at once`, {
                severity: 'warning',
              });
              return false;
            }
          });
        } else {
          // CSV or Parquet file
          // importing into a existing file, use only the first file
          for (let i = 1; i < files.length; i++) {
            addGlobalSnackbar(
              `Error importing ${files[i].name}: Cannot import multiple files at the same cursor position`,
              {
                severity: 'warning',
              }
            );
            return;
          }
          files = [files[0]];
        }
      }
      const totalFiles = files.length;

      setFilesImportProgressState(() => ({
        importing: true,
        createNewFile,
        currentFileIndex: undefined,
        files: files.map((file) => {
          const fileState: FileImportProgress = {
            name: file.name,
            size: file.size,
            step: 'read',
            progress: 0,
            transactionId: undefined,
            transactionOps: undefined,
            abortController: undefined,
          };
          return fileState;
        }),
      }));

      const uploadFilePromises: Promise<void>[] = [];

      while (files.length > 0) {
        let currentFileIndex = totalFiles - files.length;
        let file: File | undefined = files.shift();
        if (file === undefined) continue;

        setFilesImportProgressState((prev) => ({
          ...prev,
          currentFileIndex,
        }));

        const updateCurrentFileState = (newFileStatePartial: Partial<FileImportProgress>) => {
          setFilesImportProgressState((prev) => {
            const newFilesState = prev.files.map((fileState, index) => {
              if (index !== currentFileIndex) return fileState;
              const newFileState: FileImportProgress = { ...fileState, ...newFileStatePartial };
              return newFileState;
            });
            return {
              ...prev,
              files: newFilesState,
            };
          });
        };

        try {
          const fileName = file.name;
          const fileType = getFileType(file);
          const fileSize = file.size;
          const arrayBuffer = await file.arrayBuffer().catch(console.error);
          file = undefined;
          if (!arrayBuffer) {
            throw new Error('Failed to read file');
          }

          let result: { contents?: ArrayBufferLike; version?: string; error?: string } | undefined = undefined;

          if (fileType === 'Grid') {
            result = await quadraticCore.upgradeGridFile(arrayBuffer, 0);
          } else if (fileType === 'Excel' || fileType === 'CSV' || fileType === 'Parquet') {
            result = await quadraticCore.importFile({
              file: arrayBuffer,
              fileName,
              fileType,
              cursor,
              sheetId,
              location: insertAt,
              isAi: false,
              isOverwrite,
            });
          } else {
            throw new Error(`Error importing ${fileName} (${fileSize} bytes): Unsupported file type.`);
          }

          if (result?.error !== undefined) {
            throw new Error(`Error importing ${fileName} (${fileSize} bytes): ${result.error}`);
          }

          // contents and version are returned when importing into a new file
          else if (createNewFile && result?.contents !== undefined && result?.version !== undefined) {
            const name = fileName ? stripExtension(fileName) : 'Untitled';
            const contents = Buffer.from(result.contents).toString('base64');
            const version = result.version;
            const data = { name, contents, version };

            const abortController = new AbortController();
            updateCurrentFileState({ step: 'create', abortController });

            const onUploadProgress = (uploadProgress: number) => {
              const progress = (Math.round((uploadProgress ?? 0) * 100) + 200) / 3;
              const step: FileImportProgress['step'] = progress === 100 ? 'done' : 'create';
              updateCurrentFileState({ step, progress });
            };
            const uploadFilePromise = apiClient.files
              .create({
                file: data,
                teamUuid,
                isPrivate,
                folderUuid,
                abortController,
                onUploadProgress,
              })
              .then(({ file: { uuid } }) => {
                updateCurrentFileState({ step: 'done', progress: 100, uuid, abortController: undefined });
                if (openImportedFile) {
                  setFilesImportProgressState((prev) => ({ ...prev, importing: false }));
                  setFilesImportProgressListState({ show: false });
                  const searchParams = quadraticCore.receivedClientMessage ? 'negative_offsets' : '';
                  window.location.href = `${ROUTES.FILE({ uuid, searchParams })}`;
                }
              })
              .catch((error) => {
                let step: FileImportProgress['step'] = 'error';
                if (error instanceof ApiError && error.status === 499) step = 'cancel';
                updateCurrentFileState({ step, progress: 0, abortController: undefined });

                if (step !== 'cancel') {
                  throw new Error(`Error importing ${fileName} (${fileSize} bytes): ${error}`);
                }
              });

            if (userOnTeamsPage) {
              uploadFilePromises.push(uploadFilePromise);
            } else {
              await uploadFilePromise;
            }
          }
        } catch (error) {
          if (error instanceof Error) {
            fileImportSendAnalyticsError('handleImport', error);
            updateCurrentFileState({ step: 'error', progress: 0, abortController: undefined });
            addGlobalSnackbar(error.message, { severity: 'warning' });
          }
        }
      }

      // promise.all is not used here because we want to wait for all promises to be resolved
      for (const uploadFilePromise of uploadFilePromises) {
        try {
          await uploadFilePromise;
        } catch (e) {
          fileImportSendAnalyticsError('handleImport', e);
        }
      }

      // refresh the page if the user is on the team files page
      if (userOnTeamsPage && teamUuid !== undefined && !openImportedFile) {
        navigate(isPrivate ? ROUTES.TEAM_FILES_PRIVATE(teamUuid) : ROUTES.TEAM_FILES(teamUuid));
      }

      setFilesImportProgressState((prev) => ({ ...prev, importing: false }));
    },
    [addGlobalSnackbar, location.pathname, navigate, setFilesImportProgressListState, setFilesImportProgressState]
  );

  return doImport;
}
