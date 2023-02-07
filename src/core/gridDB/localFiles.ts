import localForage from 'localforage';
import debounce from 'lodash.debounce';
import { debugShowFileIO } from '../../debugFlags';
import { GridFileSchema } from '../actions/gridFile/GridFileSchema';
import { isEqualStringArrays } from '../../helpers/isEqual';

const LAST_FILES = 'last-file-queue';
const FILENAME_PREFIX = 'file-';

export const LOCAL_FILES_LOAD_EVENT = 'grid-load-event';
export type LocalFilesLoadEvent = string;
export const LOCAL_FILES_LIST_EVENT = 'grid-list-event';
export type LocalFilesListEvent = string[];

const DEFAULT_FILENAME = 'new_grid_file.grid';
const DEFAULT_DEBOUNCE_TIMER = 150;

class LocalFiles {
  filename?: string;
  fileList: string[] = [];
  private lastSavedData?: GridFileSchema;

  constructor() {
    localForage.config({ name: 'Quadratic', version: 1 });
    if (debugShowFileIO) console.log('[localFiles] initialized localForage');
  }

  private getFilename(filename: string): string {
    return `${FILENAME_PREFIX}${filename}`;
  }

  private emitListEvent(files: string[]): void {
    window.dispatchEvent(new CustomEvent<LocalFilesListEvent>(LOCAL_FILES_LIST_EVENT, { detail: files }));
  }

  async initialize(): Promise<void> {
    this.fileList = ((await localForage.getItem(LAST_FILES)) as string[]) ?? [];
    this.emitListEvent(this.fileList);
  }

  private emitLoadEvent(filename: string): void {
    this.filename = filename;
    window.dispatchEvent(new CustomEvent<LocalFilesLoadEvent>(LOCAL_FILES_LOAD_EVENT, { detail: filename }));
  }

  async newFile(): Promise<void> {
    const filename = DEFAULT_FILENAME;
    this.filename = DEFAULT_FILENAME;
    let lastFiles = (await localForage.getItem(LAST_FILES)) as string[];
    if (lastFiles) {
      lastFiles = lastFiles.filter((file) => file !== filename);
    } else {
      lastFiles = [];
    }
    lastFiles.unshift(filename);
    localForage.setItem(LAST_FILES, lastFiles);
    this.emitListEvent(lastFiles);
    if (debugShowFileIO) {
      console.log(`[localFile] Creating new file: ${DEFAULT_FILENAME} and adding to lastFiles`);
    }
  }

  private async addToFileList(filename: string, data: GridFileSchema): Promise<void> {
    const lastFiles = (await localForage.getItem(LAST_FILES)) as string[];
    if (!lastFiles) return;
    let updatedLastFiles = [...lastFiles];
    if (updatedLastFiles) {
      updatedLastFiles = lastFiles.filter((file) => file !== filename);
    } else {
      updatedLastFiles = [];
    }
    updatedLastFiles.unshift(filename);
    if (!isEqualStringArrays(lastFiles, updatedLastFiles)) {
      localForage.setItem(LAST_FILES, updatedLastFiles);
      this.emitListEvent(updatedLastFiles);
      if (debugShowFileIO) {
        console.log(
          `[localFile] Saving ${filename} (${new TextEncoder()
            .encode(JSON.stringify(data))
            .length.toLocaleString()} bytes) and adding to lastFiles (${updatedLastFiles.length} files in lastFiles)`
        );
      }
    }
  }

  async loadLocal(filename: string): Promise<GridFileSchema | undefined> {
    if (this.fileList.includes(filename)) {
      const data = await localForage.getItem(this.getFilename(filename));
      if (data) {
        this.emitLoadEvent(filename);
        this.addToFileList(filename, data as GridFileSchema);
        return data as GridFileSchema;
      }
    } else {
      throw new Error('Expected filename to be in lastFiles in loadLocal');
    }
  }

  async loadLocalLastFile(): Promise<GridFileSchema | undefined> {
    if (this.fileList.length) {
      if (debugShowFileIO) {
        console.log(
          `[localFile] Loading "${this.fileList[0]}" as last file (${this.fileList.length} files in lastFiles)`
        );
      }
      const file = await localForage.getItem(this.getFilename(this.fileList[0] as string));
      this.emitLoadEvent(this.fileList[0]);
      return file as GridFileSchema;
    }
  }

  async saveLocal(filename: string, data: GridFileSchema): Promise<void> {
    await localForage.setItem(this.getFilename(filename), data);
    this.addToFileList(filename, data);
  }

  private saveFile = debounce((): void => {
    if (!this.filename || !this.lastSavedData) return;
    const filename = this.getFilename(this.filename);
    localForage.setItem(filename, this.lastSavedData);
    if (debugShowFileIO) {
      console.log(
        `[localFile] Saving ${filename} (${new TextEncoder()
          .encode(JSON.stringify(this.lastSavedData))
          .length.toLocaleString()} bytes)`
      );
    }
    this.lastSavedData = undefined;
  }, DEFAULT_DEBOUNCE_TIMER);

  saveLastLocal(data: GridFileSchema): void {
    // don't save on NodeJS (for testing)
    if (typeof window === 'undefined') return;

    // Saving a file is debounced so this function will not execute more than once per DEFAULT_DEBOUNCE_TIMER.
    // The last function call is the one that is actually executed.
    // If you need to save immediately, call async `saveLocal`.
    if (!this.filename) {
      throw new Error('Expected filename to be defined in saveLastLocal');
    } else {
      this.lastSavedData = data;
      this.saveFile();
    }
  }

  async loadedExternalFile(filename: string, data: GridFileSchema): Promise<void> {
    this.filename = filename;
    this.emitLoadEvent(filename);
    await this.saveLocal(filename, data);
  }
}

export const localFiles = new LocalFiles();
