import { GridFileSchemaV1 } from './GridFileV1';
import { GridFileSchemaV1_1, upgradeV1toV1_1 } from './GridFileV1_1';
import { GridFile, GridFiles } from '.';
import { debugShowFileIO } from '../debugFlags';

// Ordered by newest first
const files = [{ schema: GridFileSchemaV1_1 }, { schema: GridFileSchemaV1, updateFn: upgradeV1toV1_1 }];

/**
 * Given arbitrary JSON, validate whether it's a valid file format and return
 * the newest format of the file if it is.
 */
export function validateGridFile(jsonFile: {}): GridFile | null {
  // Fn to step up through `files` and upgrade each valid file
  const updateFile = (file: GridFiles, filesIndex: number) => {
    while (filesIndex !== 0) {
      if (debugShowFileIO) console.log('[GridFile] upgrading file version: ' + file.version);
      // @ts-expect-error we know the top one doesn't have an updater function
      file = files[filesIndex].updateFn(file as GridFiles);
      filesIndex--;
    }
    return file;
  };

  // Try to validate against the newest version and then step back through history
  let isValid = false;
  let errors = [];
  for (let index = 0; index < files.length; index++) {
    const { schema } = files[index];
    const result =
      schema.shape.version.value === '1.0' ? schema.safeParse(v1Fixes(jsonFile)) : schema.safeParse(jsonFile);
    if (result.success) {
      jsonFile = updateFile(jsonFile as GridFiles, index);
      isValid = true;
      break;
    } else {
      errors.push({ version: schema.shape.version.value, error: result.error });
    }
  }

  if (!isValid) {
    if (debugShowFileIO) console.log('[validateGridFile] failed to validate file with zod.', errors);
    return null;
  }

  return jsonFile as GridFile;
}

/**
 * Small fixes we found in pre-v1 files. To be lenient, we make these
 * modifications ourselves directly.
 */
function v1Fixes(jsonFile: any): any {
  // If this value is an integer, convert to a string
  if (jsonFile) {
    if (jsonFile.version === 1) {
      jsonFile.version = '1.0';
      // Files created before Feb 2023 didn't have a version key
    } else if (!jsonFile.version) {
      jsonFile.version = '1.0';
    }
  }

  // If this value is missing, add it as an empty string
  if (jsonFile && !jsonFile.cell_dependency) {
    jsonFile.cell_dependency = '';
  }

  return jsonFile;
}
