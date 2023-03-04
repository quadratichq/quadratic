import { useCallback, useEffect, useMemo, useState } from 'react';
import localforage from 'localforage';
import { GridFileData, GridFileSchemaV1 } from './GridFileSchema';
import { debugShowFileIO } from '../debugFlags';
import { v4 as uuid } from 'uuid';
import { getURLParameter } from '../helpers/getURL';
import { downloadFile } from './downloadFile';
import { SheetController } from '../grid/controller/sheetController';

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
  loadSample: (sample: string) => void;
}

function log(...s: string[]): void {
  console.log(`[useLocalFiles] ${s[0]}`, ...s.slice(1));
}

let firstLoad = false;

export const useLocalFiles = (sheetController: SheetController): LocalFiles => {
  const { sheet } = sheetController;
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState<LocalFile[] | undefined>();
  const [lastLoaded, setLastLoaded] = useState<string | undefined>();
  const [lastFileContents, setLastFileContents] = useState<GridFileSchemaV1 | undefined>();

  const afterLoad = useCallback(
    (grid: GridFileSchemaV1) => {
      sheetController.sheet.load_file(grid);
      sheetController.clear();
      sheetController.app?.rebuild();
    },
    [sheetController]
  );

  const load = useCallback(
    async (id: string): Promise<GridFileSchemaV1 | undefined> => {
      if (!index || !index.find((entry) => entry.id === id)) {
        throw new Error('Trying to load a local file that does not exist in the file index');
      }
      const result = await localforage.getItem(id);
      if (!result) {
        throw new Error('Unable to load localFile from indexedDB');
      }

      // todo: this is where we would convert the file format if necessary

      const file = result as GridFileSchemaV1;

      log(`loaded ${file.filename}`);

      setLastLoaded(id);
      afterLoad(file);

      return file;
    },
    [index, afterLoad]
  );

  const validateFile = useCallback((file: GridFileSchemaV1): boolean => {
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
          if (overwrite === undefined && index && index.find((entry) => entry.id === gridFileJSON.id)) {
            return 'overwrite';
          }
          const id = overwrite === false ? uuid() : gridFileJSON.id;

          // save file locally
          await localforage.setItem(id, gridFileJSON);
          setLastLoaded(id);

          // update index
          const newIndex = [...(index ?? []), { filename: gridFileJSON.filename, id, modified: Date.now() }];
          setIndex(newIndex);
          await localforage.setItem(INDEX, newIndex);
          log('setting index with 1 file');

          setLastLoaded(id);
          afterLoad(gridFileJSON);
          return true;
        } else {
          log('attempted to import an invalid Quadratic file');
          return false;
        }
      } catch (e) {
        log('error while fetching file', e as string);
        return false;
      }
    },
    [index, validateFile, afterLoad]
  );

  const loadSample = useCallback(
    (sample: string): void => {
      loadQuadraticFile(`/examples/${sample}`);
    },
    [loadQuadraticFile]
  );

  useEffect(() => {
    // ensure this only runs once
    if (firstLoad) return;
    firstLoad = true;

    if (getURLParameter('clear') === '1') {
      localforage.clear();
      setIndex([]);
      log('clear requested. Loading example file');
      loadSample('default.grid');
      return;
    }

    localforage.config({ name: 'Quadratic', version: 1 });
    if (debugShowFileIO) log('initialized localForage');

    localforage.getItem(INDEX).then((result: unknown) => {
      let hasIndex = false;
      if (result) {
        hasIndex = true;
        const index = result as LocalFile[];
        index.sort((a, b) => a.modified - b.modified);
        setIndex(index);
        if (debugShowFileIO) log(`loaded index with ${index.length} files`);
      } else {
        setIndex([]);
        if (debugShowFileIO) log('index not found');
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
        setIndex([]);

        log('loading example file');
        loadSample('default.grid');
      }
    });
  }, [loadSample, loadQuadraticFile, load]);

  const save = useCallback(async (): Promise<void> => {
    if (!index || !lastFileContents) {
      throw new Error('Expected lastLoaded and index to be defined when saving a file');
    }

    // update file
    const modified = Date.now();
    const updatedFile = { ...lastFileContents, ...sheet.export_file(), modified };
    setLastFileContents(updatedFile);
    await localforage.setItem(lastFileContents.id, updatedFile);

    // update index
    const newIndex = index.map((entry) => {
      if (entry.id === lastLoaded) {
        return {
          ...entry,
          modified,
        };
      }
      return entry;
    });
    setIndex(newIndex);
    await localforage.setItem(INDEX, newIndex);
  }, [index, lastFileContents, lastLoaded, sheet]);

  const newFile = useCallback(
    async (filename?: string): Promise<void> => {
      if (!index) {
        throw new Error('Expected index to be defined in newFile');
      }
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
      setLastFileContents(newFile);
      await localforage.setItem(newFile.id, newFile);

      // update index
      const newIndex = index.map((entry) => {
        if (entry.id === lastLoaded) {
          return {
            ...entry,
            modified: created,
          };
        }
        return entry;
      });
      setIndex(newIndex);
      await localforage.setItem(INDEX, newIndex);
    },
    [index, lastLoaded]
  );

  const saveQuadraticFile = useCallback(
    (autoDownload: boolean): GridFileSchemaV1 | undefined => {
      if (!lastFileContents) return;
      const data: GridFileSchemaV1 = {
        ...lastFileContents,
        ...sheet.export_file(),
        version: VERSION,
        modified: lastFileContents?.modified,
      };

      //  auto download file
      if (autoDownload) downloadFile(data.filename, JSON.stringify(data));

      return data;
    },
    [lastFileContents, sheet]
  );

  const currentFilename = useMemo(() => {
    if (lastFileContents) {
      return lastFileContents.filename;
    }
  }, [lastFileContents]);

  return {
    loaded,
    fileList: index ?? [],
    currentFilename,
    load,
    save,
    loadQuadraticFile,
    saveQuadraticFile,
    loadSample,
    newFile,
  };
};
