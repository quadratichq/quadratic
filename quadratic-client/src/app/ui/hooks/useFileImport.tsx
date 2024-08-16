import { Coordinate } from '@/app/gridGL/types/size';
import { getFileType, stripExtension, supportedFileTypes, uploadFile } from '@/app/helpers/files';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { FileImportProgress, filesImportProgressAtom } from '@/dashboard/atoms/filesImportProgressAtom';
import { apiClient } from '@/shared/api/apiClient';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import { AxiosProgressEvent } from 'axios';
import { Buffer } from 'buffer';
import { useLocation, useNavigate } from 'react-router-dom';
import { DefaultValue, useSetRecoilState } from 'recoil';

export function useFileImport() {
  const setFilesImportProgressState = useSetRecoilState(filesImportProgressAtom);
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
    refreshTeamsPath = false,
  }: {
    files?: File[] | FileList;
    sheetId?: string;
    insertAt?: Coordinate;
    cursor?: string; // cursor is available when importing into a existing file, it is also being used as a flag to denote this
    isPrivate?: boolean;
    teamUuid?: string;
    refreshTeamsPath?: boolean;
  }) => {
    quadraticCore.initWorker();

    if (!files) files = await uploadFile(supportedFileTypes);
    if (files.length === 0) return;

    const firstFileType = getFileType(files[0]);
    const createNewFile =
      cursor === undefined && sheetId === undefined && insertAt === undefined && teamUuid !== undefined;

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
          const uploadFilePromise = apiClient.files
            .create({
              file: data,
              teamUuid,
              isPrivate,
              onUploadProgress: (progressEvent: AxiosProgressEvent) => {
                setFilesImportProgressState((prev) => {
                  if (prev instanceof DefaultValue) return prev;
                  const updatedFiles = prev.files.map((file, index) => {
                    if (index !== fileIndex) return file;
                    const newFile: FileImportProgress = {
                      name: file.name,
                      size: file.size,
                      step: 'save',
                      progress: (Math.round((progressEvent.progress ?? 0) * 100) + 200) / 3,
                      transactionId: file.transactionId,
                      transactionOps: file.transactionOps,
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
            .catch((error) => {
              setFilesImportProgressState((prev) => {
                if (prev instanceof DefaultValue) return prev;
                const updatedFiles = prev.files.map((file, index) => {
                  if (index !== fileIndex) return file;
                  const newProgress: FileImportProgress = {
                    name: file.name,
                    size: file.size,
                    step: 'error',
                    progress: 0,
                    transactionId: undefined,
                    transactionOps: undefined,
                  };
                  return newProgress;
                });
                return {
                  ...prev,
                  files: updatedFiles,
                };
              });
              throw new Error(`Error importing ${file.name}: ${error}`);
            });
          uploadFilePromises.push(uploadFilePromise);
        }
      } catch (e) {
        if (e instanceof Error) {
          addGlobalSnackbar(e.message, { severity: 'warning' });
          setFilesImportProgressState((prev) => {
            if (prev instanceof DefaultValue) return prev;
            const updatedFiles = prev.files.map((file, index) => {
              if (index !== prev.currentFileIndex) return file;
              const newFile: FileImportProgress = {
                name: file.name,
                size: file.size,
                step: 'error',
                progress: 0,
                transactionId: undefined,
                transactionOps: undefined,
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

    await Promise.all(uploadFilePromises).catch(() => {
      addGlobalSnackbar(`Error saving file`, { severity: 'error' });
    });

    if (location.pathname.includes('/teams/') && teamUuid !== undefined) {
      navigate(isPrivate ? ROUTES.TEAM_FILES_PRIVATE(teamUuid) : ROUTES.TEAM_FILES(teamUuid));
    }

    setFilesImportProgressState((prev) => ({ ...prev, importing: false }));
  };

  return handleImport;
}
