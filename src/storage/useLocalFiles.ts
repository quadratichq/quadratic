import { useCallback, useEffect, useMemo, useState } from 'react';
import localforage from 'localforage';
import { GridFileData, GridFileSchemaV1 } from './GridFileSchema';
import { debugShowFileIO } from '../debugFlags';
import { v4 as uuid } from 'uuid';
import { getURLParameter } from '../helpers/getURL';
import { downloadFile } from './downloadFile';
import { SheetController } from '../grid/controller/sheetController';
import { useRecoilState } from 'recoil';
import { fileAtom } from '../atoms/fileAtom';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';

const INDEX = 'index';
const VERSION = '1.0';

export interface LocalFile {
  filename: string;
  id: string;
  modified: number;
}

interface LocalFiles {
  loaded: boolean;
  fileList: LocalFile[];
  currentFilename: string;
  load: (id: string) => Promise<GridFileSchemaV1 | undefined>;
  save: () => Promise<void>;
  loadQuadraticFile: (url: string) => Promise<boolean>;
  newFile: (filename?: string) => void;
  saveQuadraticFile: (autoDownload: boolean) => GridFileSchemaV1 | undefined;
  loadSample: (sample: string) => Promise<void>;
  renameFile: (filename: string) => Promise<void>;
  importLocalFile: (file: File) => Promise<boolean>;
}

function log(...s: string[]): void {
  if (debugShowFileIO) console.log(`[useLocalFiles] ${s[0]}`, ...s.slice(1));
}

export const useLocalFiles = (sheetController: SheetController): LocalFiles => {
  const [fileState, setFileState] = useRecoilState(fileAtom);
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);

  const { sheet } = sheetController;
  const [loaded, setLoaded] = useState(false);

  const afterLoad = useCallback(
    (grid: GridFileSchemaV1) => {
      setFileState((state) => {
        return { ...state, lastFileContents: grid };
      });
      sheetController.clear();
      sheetController.sheet.load_file(grid);
      sheetController.app?.rebuild();
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set('local', grid.id);
      const url = `${window.location.href.split('?')[0]}?${searchParams.toString()}`;
      window.history.replaceState(undefined, '', url);
    },
    [setFileState, sheetController]
  );

  const saveIndex = useCallback(
    async (index: LocalFile[]): Promise<void> => {
      index = index.sort((a, b) => b.modified - a.modified);
      setFileState({ ...fileState, index: index, loaded: true });
      await localforage.setItem(INDEX, index);
      log(`setting index with ${index.length} file${index.length > 1 ? 's' : ''}`);
    },
    [fileState, setFileState]
  );

  const saveFile = useCallback(
    async (file: GridFileSchemaV1): Promise<void> => {
      setFileState({ ...fileState, lastFileContents: file });
      await localforage.setItem(file.id, file);
      log(`Saved ${file.filename} (${file.id})`);
    },
    [fileState, setFileState]
  );

  const load = useCallback(
    async (id: string, index: LocalFile[] = fileState.index): Promise<GridFileSchemaV1 | undefined> => {
      if (!fileState.index || !index.find((entry) => entry.id === id)) {
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
    [fileState, afterLoad]
  );

  const validateFile = useCallback((file: GridFileSchemaV1, explainWhy?: boolean): boolean => {
    const expected = [
      'cells',
      'formats',
      'columns',
      'rows',
      'borders',
      'cell_dependency',
      'version',
      'modified',
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
  }, []);

  const importQuadraticFile = useCallback(
    async (gridFileJSON: GridFileSchemaV1): Promise<boolean> => {
      if (validateFile(gridFileJSON)) {
        const newFileIndex = { filename: gridFileJSON.filename, id: uuid(), modified: Date.now() };
        const newFile = { ...gridFileJSON, ...newFileIndex };
        await saveFile(newFile);
        await saveIndex([newFile, ...fileState.index]);
        afterLoad(newFile);
        return true;
      } else {
        log(`${gridFileJSON.filename} (${gridFileJSON.id}) is an invalid Quadratic file`);
        validateFile(gridFileJSON, true);
        return false;
      }
    },
    [afterLoad, fileState.index, saveFile, saveIndex, validateFile]
  );

  /** imports an external Quadratic file -- new id is always created */
  const loadQuadraticFile = useCallback(
    async (url: string): Promise<boolean> => {
      try {
        const file = await fetch(url);
        return importQuadraticFile((await file.json()) as GridFileSchemaV1);
      } catch (e) {
        log('error while fetching file', e as string);
        return false;
      }
    },
    [importQuadraticFile]
  );

  const loadSample = useCallback(
    async (sample: string): Promise<void> => {
      await loadQuadraticFile(`/examples/${sample}`);
    },
    [loadQuadraticFile]
  );

  useEffect(() => {
    // ensure this only runs once
    if (fileState.loaded) return;

    localforage.config({ name: 'Quadratic', version: 1 });
    log('initialized localForage');

    // clear and load example file (for debugging purposes -- does not overwrite browser data)
    if (getURLParameter('clear') === '1') {
      localforage.clear();
      setFileState({ index: [], loaded: true });
      log('clear requested. Loading example file');
      loadSample('default.grid');
      return;
    }

    localforage.getItem(INDEX).then((result: unknown) => {
      let hasIndex = false;
      let index: LocalFile[];
      if (result) {
        hasIndex = true;
        index = result as LocalFile[];
        index.sort((a, b) => a.modified - b.modified);
        setFileState({ index, loaded: true });
        log(`loaded index with ${index.length} files`);
      } else {
        index = [];
        setFileState({ index, loaded: true });
        log('index not found');
      }
      setLoaded(true);
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
        setFileState({ index: [], loaded: true });
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
    fileState.loaded,
    setFileState,
    setEditorInteractionState,
    editorInteractionState,
  ]);

  const save = useCallback(async (): Promise<void> => {
    if (!fileState.lastFileContents) {
      throw new Error('Expected fileState.lastFileContents to be defined when saving a file');
    }

    // update file
    const modified = Date.now();
    const updatedFile = { ...fileState.lastFileContents, ...sheet.export_file(), modified };
    await saveFile(updatedFile);
    await saveIndex(
      fileState.index.map((entry) => {
        if (entry.id === fileState.lastFileContents?.id) {
          return {
            ...entry,
            modified,
          };
        }
        return entry;
      })
    );
  }, [fileState.index, fileState.lastFileContents, saveFile, saveIndex, sheet]);

  useEffect(() => {
    if (sheetController.app) {
      sheetController.app.save = save;
    }
  }, [save, sheetController.app]);

  const createFilename = useCallback(
    (filename?: string): string => {
      if (filename) return filename;
      const count = fileState.index.filter(
        (entry) => entry.filename.substring(0, 'Untitled'.length) === 'Untitled'
      ).length;
      if (count) {
        return `Untitled ${count + 1}`;
      }
      return 'Untitled';
    },
    [fileState.index]
  );

  const newFile = useCallback(
    async (filename?: string): Promise<void> => {
      // create file
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
      filename = createFilename(filename);
      const created = Date.now();
      const newFile: GridFileSchemaV1 = {
        ...grid,
        id: uuid(),
        created,
        version: VERSION,
        modified: created,
        filename: filename || 'Untitled',
      };
      await saveFile(newFile);
      await saveIndex([{ filename: newFile.filename, id: newFile.id, modified: newFile.modified }, ...fileState.index]);
      afterLoad(newFile);
    },
    [afterLoad, createFilename, fileState.index, saveFile, saveIndex]
  );

  const saveQuadraticFile = useCallback(
    (autoDownload: boolean): GridFileSchemaV1 | undefined => {
      if (!fileState.lastFileContents) return;
      const data: GridFileSchemaV1 = {
        ...fileState.lastFileContents,
        ...sheet.export_file(),
        version: VERSION,
        modified: fileState.lastFileContents?.modified,
      };

      //  auto download file
      if (autoDownload) downloadFile(data.filename, JSON.stringify(data));

      return data;
    },
    [fileState.lastFileContents, sheet]
  );

  const currentFilename = useMemo(() => {
    return fileState.lastFileContents?.filename || '';
  }, [fileState.lastFileContents?.filename]);

  const renameFile = useCallback(
    async (filename: string): Promise<void> => {
      if (!fileState.lastFileContents) throw new Error('Expected lastFileContents to be defined in renameFile');
      const oldFilename = fileState.lastFileContents.filename;
      const currentFileId = fileState.lastFileContents.id;
      await saveFile({ ...fileState.lastFileContents, filename });
      await saveIndex(
        fileState.index.map((file) => {
          return currentFileId === file.id
            ? {
                ...file,
                filename,
              }
            : file;
        })
      );
      log('Renamed file from `%s` to `%s` (%s)', oldFilename, filename, currentFileId);
    },
    [fileState.lastFileContents, fileState.index, saveFile, saveIndex]
  );

  const importLocalFile = useCallback(
    async (file: File): Promise<boolean> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const json = event.target?.result;
          if (json) {
            resolve(importQuadraticFile(JSON.parse(json as string) as GridFileSchemaV1));
          }
          resolve(false);
        };
        reader.onerror = (error) => resolve(false);
        reader.readAsText(file);
      });
    },
    [importQuadraticFile]
  );

  return {
    loaded,
    fileList: fileState.index,
    currentFilename,
    load,
    save,
    loadQuadraticFile,
    saveQuadraticFile,
    loadSample,
    newFile,
    renameFile,
    importLocalFile,
  };
};
