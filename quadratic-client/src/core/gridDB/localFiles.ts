import localForage from 'localforage';
import { debugShowFileIO } from '../../debugFlags';
import { GridFileSchema } from '../actions/gridFile/GridFileSchema';

const LAST_FILES = 'last-file-queue';
const FILENAME_PREFIX = 'file-';

export const LOCAL_FILES_LOAD_EVENT = 'grid-load-event';
export type LocalFilesLoadEvent = string;
export const LOCAL_FILES_LIST_EVENT = 'grid-list-event';
export type LocalFilesListEvent = string[];

const DEFAULT_FILENAME = "new_grid_file.grid";

class LocalFiles {
  filename?: string;
  fileList: string[] = [];

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
      console.log(
        `[localFile] Saving ${filename} (${new TextEncoder()
          .encode(JSON.stringify(data))
          .length.toLocaleString()} bytes) and adding to lastFiles (${lastFiles.length} files in lastFiles)`
      );
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

  saveLastLocal(data: GridFileSchema): void {
    if (!this.filename) {
      throw new Error("Expected filename to be defined in saveLastLocal");
    } else {
      localForage.setItem(this.getFilename(this.filename), data);
    }
  }

  async loadedExternalFile(filename: string, data: GridFileSchema): Promise<void> {
    this.filename = filename;
    this.emitLoadEvent(filename);
    await this.saveLocal(filename, data);
  }
}

export const localFiles = new LocalFiles();
