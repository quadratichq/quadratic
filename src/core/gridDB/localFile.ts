import localForage from 'localforage';
import { GridFileSchema } from '../actions/gridFile/GridFileSchema';

const LAST_FILE = 'last_file';
const FILENAME_PREFIX = 'file-';

function getFilename(filename: string): string {
  return `${FILENAME_PREFIX}${filename}`;
}

export async function loadLocalFile(): Promise<GridFileSchema | undefined> {
  localForage.config({ "name": "Quadratic", version: 1 });
  const filename = await localForage.getItem(LAST_FILE);
  if (filename) {
    const file = await localForage.getItem(getFilename(filename as string));
    return file as GridFileSchema;
  }
}

export async function save(filename: string, data: GridFileSchema): Promise<void> {
  localForage.setItem(getFilename(filename), data);
  localForage.setItem(LAST_FILE, filename);
}