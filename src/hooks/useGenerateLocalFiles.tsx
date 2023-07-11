import * as Sentry from '@sentry/browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import localforage from 'localforage';
import { GridFileData, GridFile, GridFileSchema, GridFiles } from '../schemas';
import { GridFileV1 } from '../schemas/GridFileV1';
import { validateGridFile } from '../schemas/validateGridFile';
import { debugShowFileIO } from '../debugFlags';
import { v4 as uuid } from 'uuid';
import { getSearchParams, updateSearchParamsInUrl } from '../helpers/searchParams';
import { downloadFile } from '../helpers/downloadFile';
import { SheetController } from '../grid/controller/sheetController';
import { useSetRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { DEFAULT_FILE_NAME, EXAMPLE_FILES, FILE_PARAM_KEY } from '../constants/app';
import apiClientSingleton from '../api-client/apiClientSingleton';
import mixpanel from 'mixpanel-browser';
const INDEX = 'file-list';

export interface LocalFile {
  filename: string;
  id: string;
  modified: number;
}

export interface LocalFiles {
  hasInitialPageLoadError: boolean;
  createNewFile: () => Promise<void>;
  currentFilename: string;
  currentFileId: string;
  currentFileIsPublic: boolean;
  currentFileIsReadOnly: boolean;
  deleteFile: (id: string) => void;
  downloadCurrentFile: () => void;
  downloadFileFromMemory: (id: string) => void;
  fileList: LocalFile[];
  initialize: () => Promise<void>;
  loadFileFromMemory: (id: string) => Promise<boolean>;
  loadFileFromDisk: (file: File) => Promise<boolean>;
  loadFileFromUrl: (url: string) => Promise<boolean>;
  loadFileFromExamples: (sample: string, filename: string) => Promise<boolean>;
  renameCurrentFile: (newFilename: string) => Promise<void>;
  shareCurrentFile: (isPublic: boolean) => Promise<void>;
  save: () => Promise<void>;
}

/**
 * This hook should ONLY be run once. The values it returns get stuck in the
 * `useLocalFiles()` provider for as a react context for use throughout the app
 */
export const useGenerateLocalFiles = (sheetController: SheetController): LocalFiles => {
  const [hasInitialPageLoadError, setHasInitialPageLoadError] = useState<boolean>(false);
  const [fileList, setFileList] = useState<LocalFile[]>([]);
  const [currentFileContents, setCurrentFileContents] = useState<GridFile | null>(null);
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  const { sheet } = sheetController;

  // Current file info
  const currentFilename = useMemo(() => {
    return currentFileContents?.filename || '';
  }, [currentFileContents?.filename]);
  const currentFileId = useMemo(() => {
    return currentFileContents?.id || '';
  }, [currentFileContents?.id]);
  const currentFileIsPublic = useMemo(() => {
    return Boolean(currentFileContents?.isPublic);
  }, [currentFileContents?.isPublic]);
  const currentFileIsReadOnly = useMemo(() => {
    if (fileList && !fileList.map(({ id }) => id).includes(currentFileId)) {
      return true;
    }
    return false;
  }, [fileList, currentFileId]);

  // Persist `fileList` to localStorage when it changes
  useEffect(() => {
    localforage.setItem(INDEX, fileList).then((newFileList) => {
      log(`persisted file list: ${newFileList.length} file${newFileList.length > 1 ? 's' : ''}`);
    });
  }, [fileList]);

  // Persist current file data and update the tab title when it changes
  useEffect(() => {
    if (currentFileContents !== null) {
      const { filename, id } = currentFileContents;

      document.title = `${filename} - Quadratic`;

      // If user owns file, persist to local storage and backup to API
      if (!currentFileIsReadOnly) {
        localforage.setItem(id, currentFileContents).then(() => {
          log(`persisted current file: ${filename} (${id})`);
        });

        apiClientSingleton.backupFile(id, currentFileContents);
      }
    } else {
      document.title = 'Quadratic';
    }
  }, [currentFileContents, currentFileIsReadOnly]);

  // Reset the sheet to the current file in state, update the URL accordingly
  const resetSheet = useCallback(
    (grid: GridFile) => {
      sheetController.clear();
      sheetController.sheet.load_file(grid);
      sheetController.app?.rebuild();
      sheetController.app?.reset();
      focusGrid();

      // Update URL to the new file we just loaded
      const { id, isPublic } = grid;
      updateSearchParamsInUrl(new URLSearchParams(isPublic ? `?share=${id}` : `?local=${id}`));
    },
    [sheetController]
  );

  // Given some contents, determine whether it's a valid file we can load into
  // Quadratic and, if it is, do what's necessary to load it.
  // Note: a new ID is always created when importing a file
  const importQuadraticFile = useCallback(
    async (contents: string, filename: string, isNewFile: boolean = true): Promise<boolean> => {
      // Try to parse the contents as JSON
      let json;
      try {
        json = JSON.parse(contents);
      } catch (e) {
        console.error('Failed to parse data as valid JSON.', contents, e);
        return false;
      }

      // Check if the JSON is a valid quadratic file
      const quadraticJson = validateGridFile(json);
      if (!quadraticJson) {
        console.error('Failed to parse JSON as a valid Quadratic file', json, contents);
        return false;
      }

      // If it's a new file
      if (isNewFile) {
        const newFileListItem = { filename, id: uuid(), modified: Date.now() };
        const newFile = { ...quadraticJson, ...newFileListItem };
        setCurrentFileContents(newFile);
        setFileList((oldFileList) => [newFileListItem, ...oldFileList]);
        resetSheet(newFile);
        log(`import success: ${filename} (${newFile.id})`);
      } else {
        // It's possible we updated the file's info, should we set .modified?
        setCurrentFileContents(quadraticJson);
        resetSheet(quadraticJson);
        log(`import success: ${filename} (${quadraticJson.id})`);
      }

      return true;
    },
    [resetSheet]
  );

  // Load a remote file over the network
  const loadFileFromUrl = useCallback(
    async (url: string, filename?: string): Promise<boolean> => {
      mixpanel.track('[Files].loadFileFromUrl', { url, filename });
      try {
        const res = await fetch(url);
        const file = await res.text();

        // If there's no specified name, derive it's name from the URL
        if (!filename) {
          filename = decodeURIComponent(massageFilename(new URL(url).pathname.split('/').pop()));
        }

        return importQuadraticFile(file, filename);
      } catch (e) {
        log('error fetching and/or loading file', e as string);
        return false;
      }
    },
    [importQuadraticFile]
  );

  // Load an example file
  const loadFileFromExamples = useCallback(
    async (sample: string, filename: string): Promise<boolean> => {
      return await loadFileFromUrl(`${window.location.origin}/examples/${sample}`, filename);
    },
    [loadFileFromUrl]
  );

  // Create a new file (and load it in the app)
  const createNewFile = useCallback(async (): Promise<void> => {
    const grid: GridFileData = {
      cells: [],
      formats: [],
      columns: [],
      rows: [],
      borders: [],
      cell_dependency: '',
    };

    mixpanel.track('[Files].newFile');

    const created = Date.now();
    const newFile: GridFile = {
      ...grid,
      id: uuid(),
      created,
      version: GridFileSchema.shape.version.value,
      modified: created,
      filename: createFilename(fileList),
    };
    setCurrentFileContents(newFile);
    setFileList((oldFileList) => [
      { filename: newFile.filename, id: newFile.id, modified: newFile.modified },
      ...oldFileList,
    ]);
    resetSheet(newFile);
  }, [resetSheet, fileList]);

  // Download the currently active file
  const downloadCurrentFile = useCallback(() => {
    if (!currentFileContents) return;
    const data: GridFile = {
      ...currentFileContents,
      ...sheet.export_file(),
    };

    downloadFile(data.filename, JSON.stringify(data));
  }, [currentFileContents, sheet]);

  // Given a file ID, download it
  const downloadFileFromMemory = useCallback(
    async (id: string): Promise<void> => {
      mixpanel.track('[Files].downloadFileFromMemory', { id });
      try {
        if (currentFileContents && currentFileContents.id === id) {
          downloadCurrentFile();
        }

        const file = (await localforage.getItem(id)) as GridFile;
        if (file) {
          downloadFile(file.filename, JSON.stringify(file));
        }
      } catch (e) {
        console.error(e);
      }
    },
    [currentFileContents, downloadCurrentFile]
  );

  // Rename the current file open in the app
  const renameCurrentFile = useCallback(
    async (newFilename: string): Promise<void> => {
      mixpanel.track('[Files].renameCurrentFile', { newFilename });
      if (!currentFileContents) throw new Error('Expected `currentFileContents` to rename the current file.');
      setCurrentFileContents({ ...currentFileContents, filename: newFilename });
      setFileList((oldFileList) =>
        oldFileList
          .map((entry) => {
            if (entry.id === currentFileContents?.id) {
              return {
                ...entry,
                filename: newFilename,
                modified: Date.now(),
              };
            }
            return entry;
          })
          .sort((a, b) => b.modified - a.modified)
      );
      log('Renamed file from `%s` to `%s` (%s)', currentFileContents.filename, newFilename, currentFileContents?.id);
    },
    [currentFileContents]
  );

  const shareCurrentFile = useCallback(
    async (isPublic: boolean) => {
      if (!currentFileContents) throw new Error('Expected `currentFileContents` to rename the current file.');
      const { id } = currentFileContents;
      setCurrentFileContents({ ...currentFileContents, isPublic, modified: Date.now() });

      // Update URL based on the state of the file
      updateSearchParamsInUrl(new URLSearchParams(isPublic ? `?share=${id}` : `?local=${id}`));

      // TODO setFileList with modified date?
      log('Update URL and set `isPublic` to `%s` for file `%s`', String(isPublic), currentFileContents?.id);
    },
    [currentFileContents]
  );

  // Load a file from the user's computer
  const loadFileFromDisk = useCallback(
    async (file: File): Promise<boolean> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          mixpanel.track('[Files].loadFileFromDisk', { fileName: file.name });
          const contents = event.target?.result;
          if (contents) {
            // Regardless of the name in the file's meta, use it's name on disk
            resolve(importQuadraticFile(contents as string, massageFilename(file.name)));
          }
          resolve(false);
        };
        reader.onerror = (error) => resolve(false);
        reader.readAsText(file);
      });
    },
    [importQuadraticFile]
  );

  // Load a file from memory
  const loadFileFromMemory = useCallback(
    async (id: string): Promise<boolean> => {
      const file: GridFiles | null = await localforage.getItem(id);
      if (!file) {
        return false;
      }
      let filename = DEFAULT_FILE_NAME;
      // @ts-expect-error
      if (file?.filename) filename = file.filename;

      mixpanel.track('[Files].loadFileFromMemory', { filename });

      return importQuadraticFile(JSON.stringify(file), filename, false);
    },
    [importQuadraticFile]
  );

  // Delete a file (cannot delete a file that's currently active)
  const deleteFile = useCallback(async (id: string) => {
    mixpanel.track('[Files].deleteFile', { id });
    setFileList((oldFileList) => oldFileList.filter((entry) => entry.id !== id));
    await localforage.removeItem(id);
    log(`deleted file: ${id}`);
  }, []);

  // Save the active file
  const save = useCallback(async (): Promise<void> => {
    if (!currentFileContents) {
      throw new Error('Expected state `currentFileContents` to be defined when saving a file');
    }

    const modified = Date.now();
    const updatedFile = { ...currentFileContents, ...sheet.export_file(), modified };
    setCurrentFileContents(updatedFile);
    setFileList((oldFileList) =>
      oldFileList
        .map((entry) => {
          if (entry.id === currentFileContents?.id) {
            return {
              ...entry,
              modified,
            };
          }
          return entry;
        })
        .sort((a, b) => b.modified - a.modified)
    );
  }, [currentFileContents, sheet]);

  useEffect(() => {
    sheetController.saveLocalFiles = save;
  }, [sheetController, save]);

  // Logic for the initial page load
  const initialize = useCallback(async () => {
    // Initialize local storage
    localforage.config({ name: 'Quadratic', version: 1 });
    log('initialized localForage');

    // @ts-expect-error
    window.lf = localforage;

    // Keep track of whether this is a first time visit to the app
    // (User clearing cache will look like first time visitor)
    let isFirstVisit = true;

    // See if we have saved files and load them into memory
    const savedFileList: LocalFile[] | null = await localforage.getItem(INDEX);
    if (savedFileList) {
      isFirstVisit = false;
      setFileList(savedFileList);
      log(`loaded saved file list (${savedFileList.length} files)`);
    }

    // Get URL params we need at initialize time
    const searchParams = getSearchParams();
    const share = searchParams.get('share');
    const local = searchParams.get('local');
    let file = searchParams.get('file');
    // We get the `file` query param from the URL, but if a user had it present
    // _before_ they logged in, we lose it through the Auth0 process, so we
    // store it in sessionStorage and use it (then delete it) if its present
    const fileParamBeforeLogin = sessionStorage.getItem(FILE_PARAM_KEY);
    if (fileParamBeforeLogin) {
      // TODO support share here too
      file = fileParamBeforeLogin;
      sessionStorage.removeItem(FILE_PARAM_KEY);
    }

    // Migrate files from old version of the app (one-time, if necessary thing)
    // Note: eventually this code can be removed
    const oldFileListKey = 'last-file-queue';
    let oldFileList: string[] | null = await localforage.getItem(oldFileListKey);
    let filesWithErrors: string[] = [];
    if (oldFileList && oldFileList.length > 0) {
      isFirstVisit = false;
      // Import each old file as a new file then delete from memory
      // (the first item in the array is the most recent, so we reverse the order
      // so it is the last one imported and the first in the new file list)
      await Promise.all(
        oldFileList.reverse().map(async (filename): Promise<[string, boolean]> => {
          let importSuccess = false;
          const itemId = `file-${filename}`;
          const contents: GridFileV1 | null = await localforage.getItem(itemId);
          importSuccess = await importQuadraticFile(JSON.stringify(contents), filename.replace('.grid', ''));
          if (importSuccess) {
            await localforage.removeItem(itemId);
          } else {
            filesWithErrors.push(filename);
            let message;
            try {
              message = JSON.stringify(contents);
            } catch (e) {
              message = contents;
            }
            Sentry.captureEvent({
              message: 'User data from old file schema failed to migrate to the new file schema',
              level: Sentry.Severity.Info,
              extra: {
                file: message,
              },
            });
          }
          log(importSuccess ? `migrated file: ${filename}` : `failed to migrate file into memory: ${filename}`);
          return [filename, importSuccess];
        })
      );
      // Only delete the old file list if we successfully migrated all old files
      if (filesWithErrors.length === 0) {
        await localforage.removeItem(oldFileListKey);
      } else {
        await localforage.setItem(oldFileListKey, filesWithErrors);
      }
    }

    // Load the app into a different state based on certain criteria
    if (file) {
      // Somebody trying to import a remote file on page load
      if (await loadFileFromUrl(file)) {
        return;
      }
      setHasInitialPageLoadError(true);
    } else if (local) {
      // Somebody trying to load a file already in memory
      if (await loadFileFromMemory(local)) {
        return;
      }
      setHasInitialPageLoadError(true);
    } else if (share) {
      // The user who generated the share URL put it into their own browser
      if (savedFileList && savedFileList.map(({ id }) => id).includes(share)) {
        log('Shared URL is owned by the current user, loading from memory...');
        if (await loadFileFromMemory(share)) {
          return;
        }
      } else {
        log('Shared URL is remote, fetching file...');
        const file = await apiClientSingleton.getFile(share);
        if (file) {
          const imported = await importQuadraticFile(JSON.stringify(file), file.filename, false);
          if (imported) return;
        }
      }
      // TODO not a great message but it's what we have ATM
      setHasInitialPageLoadError(true);
    } else if (isFirstVisit) {
      // First time visitor gets the default sample file
      log('first visit, loading example file');
      await loadFileFromExamples(EXAMPLE_FILES[0].file, EXAMPLE_FILES[0].name);
      return;
    }

    // If none of the above happen (or one failed), fall back to the default:
    // show the file menu
    setEditorInteractionState((oldState) => ({
      ...oldState,
      showFileMenu: true,
    }));
    updateSearchParamsInUrl(new URLSearchParams(''));
  }, [
    importQuadraticFile,
    loadFileFromMemory,
    loadFileFromExamples,
    loadFileFromUrl,
    setFileList,
    setEditorInteractionState,
  ]);

  return {
    hasInitialPageLoadError,
    currentFilename,
    currentFileId,
    currentFileIsPublic,
    currentFileIsReadOnly,
    deleteFile,
    downloadCurrentFile,
    downloadFileFromMemory,
    fileList,
    initialize,
    loadFileFromDisk,
    loadFileFromMemory,
    loadFileFromUrl,
    loadFileFromExamples,
    createNewFile,
    renameCurrentFile,
    shareCurrentFile,
    save,
  };
};

// Given a file name, strip out the `.grid` extension. Provide a default.
function massageFilename(str: string | undefined): string {
  let out = DEFAULT_FILE_NAME;

  if (typeof str !== 'string' || str.length === 0) {
    return out;
  }

  const extension = '.grid';
  return str.endsWith(extension) ? str.slice(0, str.length - extension.length) : str;
}

function createFilename(fileList: LocalFile[]): string {
  const count = fileList.filter(
    ({ filename }) => filename.substring(0, DEFAULT_FILE_NAME.length) === DEFAULT_FILE_NAME
  ).length;
  return DEFAULT_FILE_NAME + (count ? ` ${count + 1}` : '');
}

function log(...s: string[]): void {
  if (debugShowFileIO) console.log(`[useLocalFiles] ${s[0]}`, ...s.slice(1));
}
