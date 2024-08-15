import { Coordinate } from '@/app/gridGL/types/size';
import { getFileType, stripExtension, supportedFileTypes, uploadFile } from '@/app/helpers/files';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { fileImportProgressAtom } from '@/dashboard/atoms/fileImportProgressAtom';
import { apiClient } from '@/shared/api/apiClient';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import { Buffer } from 'buffer';
import { useNavigate, useSubmit } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';

export function useFileImport() {
  const setFileImportProgressState = useSetRecoilState(fileImportProgressAtom);
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const navigate = useNavigate();
  const submit = useSubmit();

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
    const createFile =
      cursor === undefined && sheetId === undefined && insertAt === undefined && teamUuid !== undefined;

    const redirectToFile = createFile && files.length === 1;
    const redirectToTeam = createFile && files.length > 1;
    const createPromises = [];

    if (!createFile && firstFileType === 'grid') {
      addGlobalSnackbar(`Error importing ${files[0].name}: Cannot import grid file into existing file`, {
        severity: 'warning',
      });
      files = [];
      return;
    }

    // Only one file can be imported at a time (except for excel), inside a existing file
    if (!createFile && files.length > 1) {
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

    files = Array.from(files).reverse(); // reverse the order of files to import the last file first
    const totalFilesSize = files.reduce((acc, file) => acc + file.size, 0);

    setFileImportProgressState((prev) => ({
      ...prev,
      importing: true,
      saveRequired: createFile,
      totalFiles: files.length,
      totalFilesSize,
      remainingFiles: files.length,
      remainingFilesSize: totalFilesSize,
    }));

    while (files.length > 0) {
      const file = files.pop();
      if (file === undefined) continue;

      setFileImportProgressState((prev) => ({
        ...prev,
        remainingFiles: files.length + 1,
        remainingFilesSize: (prev.remainingFilesSize ?? totalFilesSize) - (prev.currentFileSize ?? 0),
        currentFileName: file.name,
        currentFileSize: file.size,
        currentFileStep: 'read',
        currentFileReadProgress: undefined,
        currentFileCreateProgress: undefined,
        currentFileTransactionId: undefined,
        currentFileTransactionOps: undefined,
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
        else if (createFile && result?.contents !== undefined && result?.version !== undefined) {
          setFileImportProgressState((prev) => ({ ...prev, currentFileStep: 'save' }));
          const name = file.name ? stripExtension(file.name) : 'Untitled';
          const contents = Buffer.from(result.contents).toString('base64');
          const version = result.version;
          const data = { name, contents, version };
          if (redirectToFile) {
            const action = isPrivate ? ROUTES.CREATE_FILE_PRIVATE(teamUuid) : ROUTES.CREATE_FILE(teamUuid);
            submit(data, { method: 'POST', action, encType: 'application/json' });
            setFileImportProgressState((prev) => ({ ...prev, importing: false }));
          } else {
            const createPromise = apiClient.files.create({ file: data, teamUuid, isPrivate });
            createPromises.push(createPromise);
          }
        }
      } catch (e) {
        if (e instanceof Error) {
          addGlobalSnackbar(e.message, { severity: 'warning' });
        }
      }
    }

    await Promise.all(createPromises).catch(() => {
      addGlobalSnackbar(`Error saving file`, { severity: 'error' });
    });

    if (redirectToTeam) {
      navigate(isPrivate ? ROUTES.TEAM_FILES_PRIVATE(teamUuid) : ROUTES.TEAM_FILES(teamUuid));
    }

    setFileImportProgressState((prev) => ({ ...prev, importing: false }));
  };

  return handleImport;
}
