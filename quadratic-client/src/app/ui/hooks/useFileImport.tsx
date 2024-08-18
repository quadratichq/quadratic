import { Coordinate } from '@/app/gridGL/types/size';
import { getFileType, stripExtension, supportedFileTypes, uploadFile } from '@/app/helpers/files';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { FileImportProgress, filesImportProgressAtom } from '@/dashboard/atoms/filesImportProgressAtom';
import { filesImportProgressListAtom } from '@/dashboard/atoms/filesImportProgressListAtom';
import { apiClient } from '@/shared/api/apiClient';
import { ApiError } from '@/shared/api/fetchFromApi';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import { Buffer } from 'buffer';
import { useLocation, useNavigate } from 'react-router-dom';
import { DefaultValue, useSetRecoilState } from 'recoil';

export function useFileImport() {
  const setFilesImportProgressState = useSetRecoilState(filesImportProgressAtom);
  const setFilesImportProgressListState = useSetRecoilState(filesImportProgressListAtom);

  const { addGlobalSnackbar } = useGlobalSnackbar();

  const location = useLocation();
  const navigate = useNavigate();

  const handleImport = async ({
    files,
    sheetId,
    insertAt,
    cursor,
    isPrivate = true,
    teamUuid,
  }: {
    files?: File[] | FileList;
    sheetId?: string;
    insertAt?: Coordinate;
    cursor?: string; // cursor is available when importing into a existing file, it is also being used as a flag to denote this
    isPrivate?: boolean;
    teamUuid?: string;
  }) => {
    quadraticCore.initWorker();

    if (!files) files = await uploadFile(supportedFileTypes);
    if (files.length === 0) return;

    const firstFileType = getFileType(files[0]);
    const createNewFile =
      cursor === undefined && sheetId === undefined && insertAt === undefined && teamUuid !== undefined;
    const userOnTeamsPage = location.pathname.includes('/teams/');
    if (userOnTeamsPage) {
      setFilesImportProgressListState(() => ({ show: true }));
    }

    if (!createNewFile && firstFileType === 'grid') {
      addGlobalSnackbar(`Error importing ${files[0].name}: Cannot import grid file into existing file`, {
        severity: 'warning',
      });
      files = [];
      return;
    }

    // Only one file can be imported at a time (except for excel), inside a existing file
    if (!createNewFile && files.length > 1) {
      if (firstFileType === 'excel') {
        // importing into a existing file, use only excel files
        files = [...files].filter((file) => {
          if (getFileType(file) === 'excel') {
            return true;
          } else {
            addGlobalSnackbar(`Error importing ${file.name}: Cannot import multiple types files at once`, {
              severity: 'warning',
            });
            return false;
          }
        });
      } else {
        // csv or parquet file
        // importing into a existing file, use only the first file
        for (let i = 1; i < files.length; i++) {
          addGlobalSnackbar(
            `Error importing ${files[i].name}: Cannot import multiple files at the same cursor position`,
            {
              severity: 'warning',
            }
          );
        }
        files = [files[0]];
      }
    }

    files = Array.from(files);

    setFilesImportProgressState(() => ({
      importing: true,
      createNewFile,
      currentFileIndex: -1,
      files: files.map((file) => ({
        name: file.name,
        size: file.size,
        step: 'read',
        progress: 0,
        transactionId: undefined,
        transactionOps: undefined,
      })),
    }));

    const uploadFilePromises = [];

    while (files.length > 0) {
      const file = files.shift();
      if (file === undefined) continue;

      setFilesImportProgressState((prev) => ({
        ...prev,
        currentFileIndex: prev.currentFileIndex + 1,
      }));

      try {
        const fileType = getFileType(file);
        const arrayBuffer = await file.arrayBuffer().catch(console.error);
        if (!arrayBuffer) {
          throw new Error('Failed to read file');
        }

        let result: { contents?: ArrayBuffer; version?: string; error?: string } | undefined = undefined;

        switch (fileType) {
          case 'grid':
            result = await quadraticCore.upgradeGridFile(arrayBuffer, 0);
            break;
          case 'excel':
            result = await quadraticCore.importExcel(arrayBuffer, file.name, cursor);
            break;
          case 'csv':
            result = await quadraticCore.importCsv(arrayBuffer, file.name, sheetId, insertAt, cursor);
            break;
          case 'parquet':
            result = await quadraticCore.importParquet(arrayBuffer, file.name, sheetId, insertAt, cursor);
            break;
          default:
            throw new Error(`Error importing ${file.name}: Unsupported file type`);
        }

        if (result?.error !== undefined) {
          throw new Error(`Error importing ${file.name}: ${result.error}`);
        }

        // contents and version are returned when importing into a new file
        else if (createNewFile && result?.contents !== undefined && result?.version !== undefined) {
          const name = file.name ? stripExtension(file.name) : 'Untitled';
          const contents = Buffer.from(result.contents).toString('base64');
          const version = result.version;
          const data = { name, contents, version };
          const fileIndex = uploadFilePromises.length;
          const abortController = new AbortController();
          const uploadFilePromise = apiClient.files
            .create({
              file: data,
              teamUuid,
              isPrivate,
              abortController,
              onUploadProgress: (uploadProgress: number) => {
                setFilesImportProgressState((prev) => {
                  if (prev instanceof DefaultValue) return prev;
                  const updatedFiles = prev.files.map((file, index) => {
                    if (index !== fileIndex) return file;
                    const progress = (Math.round((uploadProgress ?? 0) * 100) + 200) / 3;
                    const newFile: FileImportProgress = {
                      ...file,
                      step: progress === 100 ? 'done' : 'save',
                      progress,
                      abortController,
                    };
                    return newFile;
                  });
                  return {
                    ...prev,
                    files: updatedFiles,
                  };
                });
              },
            })
            .then(({ file: { uuid } }) => {
              setFilesImportProgressState((prev) => {
                if (prev instanceof DefaultValue) return prev;
                const updatedFiles = prev.files.map((file, index) => {
                  if (index !== fileIndex) return file;
                  const newProgress: FileImportProgress = {
                    ...file,
                    step: 'done',
                    progress: 100,
                    uuid,
                    abortController: undefined,
                  };
                  return newProgress;
                });
                return {
                  ...prev,
                  files: updatedFiles,
                };
              });
            })
            .catch((error) => {
              let step: FileImportProgress['step'] = 'error';
              if (error instanceof ApiError && error.status === 499) {
                step = 'cancel';
              }
              setFilesImportProgressState((prev) => {
                if (prev instanceof DefaultValue) return prev;
                const updatedFiles = prev.files.map((file, index) => {
                  if (index !== fileIndex) return file;
                  const newProgress: FileImportProgress = {
                    ...file,
                    step,
                    progress: 0,
                    abortController: undefined,
                  };
                  return newProgress;
                });
                return {
                  ...prev,
                  files: updatedFiles,
                };
              });
              if (step !== 'cancel') {
                throw new Error(`Error importing ${file.name}: ${error}`);
              }
            });

          if (userOnTeamsPage) {
            uploadFilePromises.push(uploadFilePromise);
          } else {
            await uploadFilePromise;
          }
        }
      } catch (e) {
        if (e instanceof Error) {
          addGlobalSnackbar(e.message, { severity: 'warning' });
          setFilesImportProgressState((prev) => {
            if (prev instanceof DefaultValue) return prev;
            const updatedFiles = prev.files.map((file, index) => {
              if (index !== prev.currentFileIndex) return file;
              const newFile: FileImportProgress = {
                ...file,
                step: 'error',
                progress: 0,
                abortController: undefined,
              };
              return newFile;
            });
            return {
              ...prev,
              files: updatedFiles,
            };
          });
        }
      }
    }

    // promise.all is not used here because we want to wait for all promises to be resolved
    for (const uploadFilePromise of uploadFilePromises) {
      try {
        await uploadFilePromise;
      } catch (e) {
        console.error(e);
      }
    }

    // refresh the page if the user is on the team files page
    if (userOnTeamsPage && teamUuid !== undefined) {
      navigate(isPrivate ? ROUTES.TEAM_FILES_PRIVATE(teamUuid) : ROUTES.TEAM_FILES(teamUuid));
    }

    setFilesImportProgressState((prev) => ({ ...prev, importing: false }));
  };

  return handleImport;
}
