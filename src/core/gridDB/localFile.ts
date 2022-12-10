import localForage from 'localforage';
import { debugShowFileIO } from '../../debugFlags';
import { GridFileSchema } from '../actions/gridFile/GridFileSchema';

const LAST_FILES = 'last-file-queue';
const FILENAME_PREFIX = 'file-';

function getFilename(filename: string): string {
  return `${FILENAME_PREFIX}${filename}`;
}

localForage.config({ "name": "Quadratic", version: 1 });

export async function loadLocalFile(): Promise<GridFileSchema | undefined> {
  const lastFiles = await localForage.getItem(LAST_FILES) as string[];
  if (lastFiles?.length) {
    if (debugShowFileIO) {
      console.log(`[localFile] Loading "${lastFiles[0]}" as last file (${lastFiles.length} files in lastFiles)`);
    }
    const file = await localForage.getItem(getFilename(lastFiles[0] as string));
    return file as GridFileSchema;
  }
}

export async function saveLocalFile(filename: string, data: GridFileSchema): Promise<void> {
  await localForage.setItem(getFilename(filename), data);
  let lastFiles = await localForage.getItem(LAST_FILES) as string[];
  if (lastFiles) {
    lastFiles = lastFiles.filter(file => file !== filename);
  } else {
    lastFiles = [];
  }
  lastFiles.unshift(filename);
  localForage.setItem(LAST_FILES, lastFiles);
  if (debugShowFileIO) {
    console.log(`[localFile] Saving ${filename} (${(new TextEncoder().encode(JSON.stringify(data))).length.toLocaleString()} bytes) and adding to lastFiles (${lastFiles.length} files in lastFiles)`);
  }
}