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
  currentFilename?: string;
  load: (id: string) => Promise<GridFileSchemaV1 | undefined>;
  save: () => Promise<void>;
  loadQuadraticFile: (url: string, overwrite: boolean | undefined) => Promise<boolean | 'overwrite'>;
  newFile: (filename?: string) => void;
  saveQuadraticFile: (autoDownload: boolean) => GridFileSchemaV1 | undefined;
  loadSample: (sample: string) => Promise<void>;
}

function log(...s: string[]): void {
  if (debugShowFileIO) console.log(`[useLocalFiles] ${s[0]}`, ...s.slice(1));
}

export const useLocalFiles = (sheetController: SheetController): LocalFiles => {
  const [fileState, setFileState] = useRecoilState(fileAtom);

  const { sheet } = sheetController;
  const [loaded, setLoaded] = useState(false);

  const afterLoad = useCallback(
    (grid: GridFileSchemaV1) => {
      setFileState(state => {
        return { ...state, lastFileContents: grid }
      });
      sheetController.sheet.load_file(grid);
      sheetController.clear();
      sheetController.app?.rebuild();
    },
    [setFileState, sheetController]
  );

  const saveIndex = useCallback(async (index: LocalFile[]): Promise<void> => {
    index = index.sort((a, b) => b.modified - a.modified);
    setFileState({ ...fileState, index: index, loaded: true });
    await localforage.setItem(INDEX, index);
    log(`setting index with ${index.length} file${index.length > 1 ? 's' : ''}`);
  }, [fileState, setFileState]);

  const saveFile = useCallback(async (file: GridFileSchemaV1): Promise<void> => {
    setFileState({ ...fileState, lastFileContents: file });
    await localforage.setItem(file.id, file);
    log(`Saved ${file.filename} (${file.id})`);
  }, [fileState, setFileState]);

  const load = useCallback(
    async (id: string): Promise<GridFileSchemaV1 | undefined> => {
      if (!fileState.index || !fileState.index.find((entry) => entry.id === id)) {
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

  /**
   * loads an external Quadratic file
   * @param url of the file
   * @param overwrite false = creates a new version of the imported file with a different id; true = overwrite; undefined = return 'overwrite'
   */
  const loadQuadraticFile = useCallback(
    async (url: string, overwrite?: boolean): Promise<boolean | 'overwrite'> => {
      try {
        const file = await fetch(url);
        const gridFileJSON = (await file.json()) as GridFileSchemaV1;
        if (validateFile(gridFileJSON)) {
          // don't overwrite existing file unless user
          if (overwrite === undefined && fileState.index.find((entry) => entry.id === gridFileJSON.id)) {
            return 'overwrite';
          }
          const id = overwrite === false ? uuid() : gridFileJSON.id;
          const newFileIndex = { filename: gridFileJSON.filename, id, modified: Date.now() };
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
      } catch (e) {
        log('error while fetching file', e as string);
        return false;
      }
    },
    [validateFile, fileState.index, saveFile, saveIndex, afterLoad]
  );

  const loadSample = useCallback(
    async (sample: string): Promise<void> => {
      await loadQuadraticFile(`/examples/${sample}`, false);
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
      if (result) {
        hasIndex = true;
        const index = result as LocalFile[];
        index.sort((a, b) => a.modified - b.modified);
        setFileState({ index, loaded: true });
        log(`loaded index with ${index.length} files`);
      } else {
        setFileState({ index: [], loaded: true });
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
        load(local);
        return;
      }
      if (!hasIndex) {
        setFileState({ index: [], loaded: true });
        log('loading example file');
        loadSample('default.grid');
      }
    });
  }, [loadSample, loadQuadraticFile, load, fileState, setFileState]);

  const save = useCallback(async (): Promise<void> => {
    if (!fileState.lastFileContents) {
      throw new Error('Expected fileState.lastFileContents to be defined when saving a file');
    }

    // update file
    const modified = Date.now();
    const updatedFile = { ...fileState.lastFileContents, ...sheet.export_file(), modified };
    await saveFile(updatedFile);
    await saveIndex(fileState.index.map((entry) => {
      if (entry.id === fileState.lastFileContents?.id) {
        return {
          ...entry,
          modified,
        };
      }
      return entry;
    }));
  }, [fileState.index, fileState.lastFileContents, saveFile, saveIndex, sheet]);

  useEffect(() => {
    if (sheetController.app) {
      sheetController.app.save = save;
    }
  }, [save, sheetController.app]);

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
    },
    [fileState.index, saveFile, saveIndex]
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
    return fileState.lastFileContents?.filename;
  }, [fileState.lastFileContents?.filename]);

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
  };
};
