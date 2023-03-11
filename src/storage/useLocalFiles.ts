import { useCallback, useEffect, useMemo, useState } from 'react';
import localforage from 'localforage';
import { GridFileData, GridFileSchemaV1 } from './GridFileSchema';
import { debugShowFileIO } from '../debugFlags';
import { v4 as uuid } from 'uuid';
import { getURLParameter } from '../helpers/getURL';
import { downloadFile } from './downloadFile';
import { SheetController } from '../grid/controller/sheetController';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';

const INDEX = 'index';
const VERSION = '1.0';

export interface LocalFile {
  filename: string;
  id: string;
  modified: number;
}

export interface LocalFiles {
  fileList: LocalFile[];
  currentFilename: string;
  currentFileId: string;
  load: (id: string) => Promise<GridFileSchemaV1 | undefined>;
  save: () => Promise<void>;
  loadQuadraticFile: (url: string) => Promise<boolean>;
  newFile: () => Promise<void>;
  downloadQuadraticFile: () => void;
  loadSample: (sample: string) => Promise<boolean>;
  renameFile: (filename: string) => Promise<void>;
  importLocalFile: (file: File) => Promise<boolean>;
  deleteFile: (id: string) => void;
}

export const useLocalFiles = (sheetController: SheetController): LocalFiles => {
  const [hookLoaded, setHookLoaded] = useState<boolean>(false);
  const [fileListIndex, setFileListIndex] = useState<LocalFile[]>([]);
  const [currentFileContents, setCurrentFileContents] = useState<GridFileSchemaV1 | null>(null);
  // TODO Move this recoil state into the hook
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { sheet } = sheetController;

  const afterLoad = useCallback(
    (grid: GridFileSchemaV1) => {
      setCurrentFileContents(grid);
      sheetController.clear();
      sheetController.sheet.load_file(grid);
      sheetController.app?.rebuild();
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set('local', grid.id);
      const url = `${window.location.href.split('?')[0]}?${searchParams.toString()}`;
      window.history.replaceState(undefined, '', url);
    },
    [setCurrentFileContents, sheetController]
  );

  // Rename `saveAndPersistFileListIndex` - Save index to react state, then persist to local storage
  const saveIndex = useCallback(
    async (newFileListIndex: LocalFile[]): Promise<void> => {
      newFileListIndex.sort((a, b) => b.modified - a.modified); // TODO sort here? Or elsewhere
      setFileListIndex(newFileListIndex);
      await localforage.setItem(INDEX, newFileListIndex);
      log(`setting index with ${newFileListIndex.length} file${newFileListIndex.length > 1 ? 's' : ''}`);
    },
    [setFileListIndex]
  );

  // Rename `saveAndPersistActiveFile` - save file to react state, then localstorage
  // note: saveFile and afterLoad are both setting local state
  const saveFile = useCallback(
    async (file: GridFileSchemaV1): Promise<void> => {
      setCurrentFileContents(file);
      await localforage.setItem(file.id, file);
      log(`Saved ${file.filename} (${file.id})`);
    },
    [setCurrentFileContents]
  );

  // ?? load a local file from the index
  // TODO probably move this directly into the one spot we use it
  const load = useCallback(
    async (id: string, index: LocalFile[] = fileListIndex): Promise<GridFileSchemaV1 | undefined> => {
      if (!fileListIndex || !index.find((entry) => entry.id === id)) {
        throw new Error('Trying to load a local file that does not exist in the file index');
      }
      const result = await localforage.getItem(id);
      if (!result) {
        throw new Error(`Unable to load ${id} from useLocalFiles`);
      }

      // todo: this is where we would convert the file format if necessary

      const file = result as GridFileSchemaV1;

      log(`loaded ${file.filename}`);

      afterLoad(file);

      return file;
    },
    [fileListIndex, afterLoad]
  );

  // importFile - take a file and 1) save file to LS, 2) save file meta to index, 3) save to react state
  const importQuadraticFile = useCallback(
    async (gridFileJSON: GridFileSchemaV1): Promise<boolean> => {
      if (validateFile(gridFileJSON)) {
        const newFileIndex = { filename: gridFileJSON.filename, id: uuid(), modified: Date.now() };
        const newFile = { ...gridFileJSON, ...newFileIndex };
        await saveFile(newFile);
        await saveIndex([newFile, ...fileListIndex]);
        afterLoad(newFile);
        log(`import success: ${gridFileJSON.filename} (${gridFileJSON.id})`);
        return true;
      } else {
        log(`import failed: ${gridFileJSON.filename} (${gridFileJSON.id}) is an invalid Quadratic file`);
        validateFile(gridFileJSON, true);
        return false;
      }
    },
    [afterLoad, fileListIndex, saveFile, saveIndex]
  );

  /** imports an external Quadratic file -- new id is always created */
  const loadQuadraticFile = useCallback(
    async (url: string): Promise<boolean> => {
      try {
        const res = await fetch(url);
        const file = (await res.json()) as GridFileSchemaV1;

        // If it's not an example file, overwrite the file's `filename` to match
        // the last path in the URL
        if (!url.startsWith('/examples/')) {
          file.filename = massageFilename(new URL(url).pathname.split('/').pop());
        }

        return importQuadraticFile(file);
      } catch (e) {
        log('error while fetching file', e as string);
        return false;
      }
    },
    [importQuadraticFile]
  );

  // TODO Rename to match `importQuadraticFile` like `loadSampleQuadraticFile`
  const loadSample = useCallback(
    async (sample: string): Promise<boolean> => {
      return await loadQuadraticFile(`/examples/${sample}`);
    },
    [loadQuadraticFile]
  );

  useEffect(() => {
    // ensure this only runs once
    if (hookLoaded) return;
    setHookLoaded(true);

    localforage.config({ name: 'Quadratic', version: 1 });
    log('initialized localForage');

    // clear and load example file (for debugging purposes -- does not overwrite browser data)
    // TODO this doesn't work
    if (getURLParameter('clear') === '1') {
      localforage.clear();
      setFileListIndex([]);
      log('clear requested. Loading example file');
      loadSample('default.grid');
      return;
    }

    // TODO read & refactor this
    localforage.getItem(INDEX).then((result: unknown) => {
      let hasIndex = false;
      let index: LocalFile[];
      if (result) {
        hasIndex = true;
        index = result as LocalFile[];
        index.sort((a, b) => b.modified - a.modified);
        setFileListIndex(index);
        log(`loaded index with ${index.length} files`);
      } else {
        index = [];
        setFileListIndex(index);
        log('index not found');
      }

      // TODO async these
      const file = getURLParameter('file');
      if (file) {
        loadQuadraticFile(file);
        return;
      }
      const local = getURLParameter('local');
      if (local) {
        load(local, index);
        return;
      }

      if (!hasIndex) {
        setFileListIndex([]);
        log('loading example file');
        loadSample('default.grid');
      } else {
        setEditorInteractionState({
          ...editorInteractionState,
          showFileMenu: true,
        });
      }
    });
  }, [
    loadSample,
    loadQuadraticFile,
    load,
    setFileListIndex,
    setEditorInteractionState,
    editorInteractionState,
    hookLoaded,
  ]);

  // saveActiveFile
  const save = useCallback(async (): Promise<void> => {
    if (!currentFileContents) {
      throw new Error('Expected state `currentFileContents` to be defined when saving a file');
    }

    // update file
    const modified = Date.now();
    const updatedFile = { ...currentFileContents, ...sheet.export_file(), modified };
    await saveFile(updatedFile);
    await saveIndex(
      fileListIndex.map((entry) => {
        if (entry.id === currentFileContents?.id) {
          return {
            ...entry,
            modified,
          };
        }
        return entry;
      })
    );
  }, [fileListIndex, currentFileContents, saveFile, saveIndex, sheet]);

  useEffect(() => {
    if (sheetController.app) {
      sheetController.app.save = save;
    }
  }, [save, sheetController.app]);

  const newFile = useCallback(async (): Promise<void> => {
    // create a new file
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
    const newFile: GridFileSchemaV1 = {
      ...grid,
      id: uuid(),
      created,
      version: VERSION,
      modified: created,
      filename: createFilename(fileListIndex),
    };
    await saveFile(newFile);
    await saveIndex([{ filename: newFile.filename, id: newFile.id, modified: newFile.modified }, ...fileListIndex]);
    afterLoad(newFile);
  }, [afterLoad, fileListIndex, saveFile, saveIndex]);

  // Download quadratic file
  const downloadQuadraticFile = useCallback(() => {
    if (!currentFileContents) return;
    const data: GridFileSchemaV1 = {
      ...currentFileContents,
      ...sheet.export_file(),
      version: VERSION,
      modified: currentFileContents?.modified,
    };

    // auto download file
    downloadFile(data.filename, JSON.stringify(data));
  }, [currentFileContents, sheet]);

  const currentFilename = useMemo(() => {
    return currentFileContents?.filename || '';
  }, [currentFileContents?.filename]);

  const currentFileId = useMemo(() => {
    return currentFileContents?.id || '';
  }, [currentFileContents?.id]);

  const renameFile = useCallback(
    async (newFilename: string): Promise<void> => {
      if (!currentFileContents) throw new Error('Expected lastFileContents to be defined in renameFile');
      await saveFile({ ...currentFileContents, filename: newFilename });
      await saveIndex(
        fileListIndex.map((entry) => {
          if (entry.id === currentFileContents?.id) {
            return {
              ...entry,
              filename: newFilename,
              modified: Date.now(),
            };
          }
          return entry;
        })
      );
      log('Renamed file from `%s` to `%s` (%s)', currentFileContents.filename, newFilename, currentFileContents?.id);
    },
    [currentFileContents, fileListIndex, saveFile, saveIndex]
  );

  const importLocalFile = useCallback(
    async (file: File): Promise<boolean> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const json = event.target?.result;
          if (json) {
            const parsedFile = JSON.parse(json as string) as GridFileSchemaV1;
            parsedFile.filename = massageFilename(file.name);
            resolve(importQuadraticFile(parsedFile));
          }
          resolve(false);
        };
        reader.onerror = (error) => resolve(false);
        reader.readAsText(file);
      });
    },
    [importQuadraticFile]
  );

  const deleteFile = useCallback(
    async (id: string) => {
      if (!fileListIndex || !fileListIndex.find((entry) => entry.id === id)) {
        throw new Error('Trying to load a local file that does not exist in the file index');
      }
      saveIndex(fileListIndex.filter((entry) => entry.id !== id));
      await localforage.removeItem(id);
      log(`deleted file (${id})`);
    },
    [fileListIndex, saveIndex]
  );

  return {
    fileList: fileListIndex,
    currentFilename,
    currentFileId,
    load,
    save,
    loadQuadraticFile,
    downloadQuadraticFile,
    loadSample,
    newFile,
    renameFile,
    importLocalFile,
    deleteFile,
  };
};

function massageFilename(str: string | undefined): string {
  let out = 'Untitled';

  if (typeof str !== 'string' || str.length === 0) {
    return out;
  }

  const extension = '.grid';
  return str.endsWith(extension) ? str.slice(0, str.length - extension.length) : str;
}

function validateFile(file: GridFileSchemaV1, explainWhy?: boolean): boolean {
  const expected = [
    'cells',
    'formats',
    'columns',
    'rows',
    'borders',
    'cell_dependency',
    'version',
    'modified', // TODO older files that don't have modified should still be valid we just add it
    'created',
    'id',
    'filename',
  ];
  for (const key of expected) {
    if (!(file as any)[key]) {
      if (explainWhy) {
        console.log(`${key} is not properly defined`);
      }
      return false;
    }
  }
  return true;
}

function createFilename(fileListIndex: LocalFile[]): string {
  const count = fileListIndex.filter(({ filename }) => filename.substring(0, 'Untitled'.length) === 'Untitled').length;
  return 'Untitled' + (count ? ` ${count + 1}` : '');
}

function log(...s: string[]): void {
  if (debugShowFileIO) console.log(`[useLocalFiles] ${s[0]}`, ...s.slice(1));
}
