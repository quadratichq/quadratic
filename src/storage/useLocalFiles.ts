import { useCallback, useEffect, useMemo, useState } from 'react';
import localforage from 'localforage';
import { GridFileData, GridFile, GridFileSchema, validateFile, GridFiles } from './GridFile';
import { debugShowFileIO } from '../debugFlags';
import { v4 as uuid } from 'uuid';
import { getURLParameter } from '../helpers/getURL';
import { downloadFile } from './downloadFile';
import { SheetController } from '../grid/controller/sheetController';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { DEFAULT_FILE_NAME, EXAMPLE_FILES } from '../constants/app';

const INDEX = 'index';

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
  save: () => Promise<void>;
}

export const useLocalFiles = (sheetController: SheetController): LocalFiles => {
  const [hasInitialPageLoadError, setHasInitialPageLoadError] = useState<boolean>(false);
  const [fileList, setFileList] = useState<LocalFile[]>([]);
  const [currentFileContents, setCurrentFileContents] = useState<GridFile | null>(null);
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { sheet } = sheetController;

  // Persist `fileList` to localStorage when it changes
  useEffect(() => {
    localforage.setItem(INDEX, fileList).then((newFileList) => {
      log(`persisted file list: ${newFileList.length} file${newFileList.length > 1 ? 's' : ''}`);
    });
  }, [fileList]);

  // Persist `currentFileContents` to localStorage and update the tab title
  // when it changes
  useEffect(() => {
    if (currentFileContents !== null) {
      const { filename, id } = currentFileContents;
      localforage.setItem(id, currentFileContents).then(() => {
        document.title = `${filename} - Quadratic`;
        log(`persisted current file: ${filename} (${id})`);
      });
    } else {
      document.title = 'Quadratic';
    }
  }, [currentFileContents]);

  // Reset the sheet to the current file in state, update the URL accordingly
  const resetSheet = useCallback(
    (grid: GridFile) => {
      sheetController.clear();
      sheetController.sheet.load_file(grid);
      sheetController.app?.rebuild();
      const searchParams = new URLSearchParams(window.location.search);
      // If `file` is in there from an intial page load, remove it
      if (searchParams.get('file')) {
        searchParams.delete('file');
      }
      searchParams.set('local', grid.id);
      const url = `${window.location.href.split('?')[0]}?${searchParams.toString()}`;
      window.history.replaceState(undefined, '', url);
    },
    [sheetController]
  );

  // Given some contents, determine whether it's a valid file we can load into
  // Quadratic and, if it is, do what's necessary to load it.
  // Note: a new ID is always created when importing a file
  const importQuadraticFile = useCallback(
    async (contents: string, filename: string, isNewFile: boolean = true): Promise<boolean> => {
      // Try to parse the contents as JSON
      let quadraticJson;
      try {
        quadraticJson = JSON.parse(contents) as any;
      } catch (e) {
        console.error('Failed to parse data as valid JSON.', e);
        return false;
      }

      // Check if the JSON is a valid quadratic file
      quadraticJson = validateFile(quadraticJson) as GridFile | null;
      if (!quadraticJson) {
        console.error('Failed to parse data as a valid Quadratic file');
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
      try {
        const res = await fetch(url);
        const file = await res.text();

        // If there's no specified name, derive it's name from the URL
        if (!filename) {
          filename = massageFilename(new URL(url).pathname.split('/').pop());
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

      // todo: this goes away when alignment branch is merged
      render_dependency: [],
    };

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

  const currentFilename = useMemo(() => {
    return currentFileContents?.filename || '';
  }, [currentFileContents?.filename]);

  const currentFileId = useMemo(() => {
    return currentFileContents?.id || '';
  }, [currentFileContents?.id]);

  // Rename the current file open in the app
  const renameCurrentFile = useCallback(
    async (newFilename: string): Promise<void> => {
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

  // Load a file from the user's computer
  const loadFileFromDisk = useCallback(
    async (file: File): Promise<boolean> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
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

      return importQuadraticFile(JSON.stringify(file), filename, false);
    },
    [importQuadraticFile]
  );

  // Delete a file (cannot delete a file that's currently active)
  const deleteFile = useCallback(async (id: string) => {
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
    if (sheetController.app) {
      sheetController.app.save = save;
    }
  }, [save, sheetController.app]);

  // Logic for the initial page load
  const initialize = useCallback(async () => {
    // Initialize local storage
    localforage.config({ name: 'Quadratic', version: 1 });
    log('initialized localForage');

    // Handle initial page load from memory or a fresh slate
    const result = await localforage.getItem(INDEX);

    // If there's a list of files in memory, load it into the app's state
    let isFirstVisit = true;
    const newFileList = (result ? result : fileList) as LocalFile[];
    if (result) {
      isFirstVisit = false;
      setFileList(newFileList);
      log(`loaded index with ${newFileList.length} files`);
    } else {
      log('index not found');
    }

    // If there's a remote file URL, try fetching and loading it
    // Or if there's a local file ID, try loading it
    const file = getURLParameter('file');
    const local = getURLParameter('local');
    if (file) {
      const loaded = await loadFileFromUrl(file);
      if (loaded) {
        return;
      } else {
        setHasInitialPageLoadError(true);
      }
    } else if (local) {
      const loaded = await loadFileFromMemory(local);
      if (loaded) {
        return;
      } else {
        setHasInitialPageLoadError(true);
      }
    }

    // If none of the above are true, or they failed, fallback to default
    // functionality: if it's your first time then load a default file,
    // otherwise show the file menu
    if (isFirstVisit) {
      log('first visit, loading example file');
      await loadFileFromExamples(EXAMPLE_FILES[0].file, EXAMPLE_FILES[0].name);
    } else {
      setEditorInteractionState({
        ...editorInteractionState,
        showFileMenu: true,
      });
    }
  }, [
    fileList,
    loadFileFromMemory,
    loadFileFromExamples,
    loadFileFromUrl,
    setFileList,
    setEditorInteractionState,
    editorInteractionState,
  ]);

  return {
    hasInitialPageLoadError,
    currentFilename,
    currentFileId,
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
