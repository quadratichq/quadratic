import { GridFile, GridFiles } from '.';
import { GridFileSchemaV1_0 } from './GridFileV1_0';
import { GridFileSchemaV1_1, upgradeV1_0toV1_1 } from './GridFileV1_1';
import { GridFileSchemaV1_2, upgradeV1_1toV1_2 } from './GridFileV1_2';
import { GridFileSchemaV1_3, upgradeV1_2toV1_3 } from './GridFileV1_3';
import { versionGTE as versionGreaterOrEqualTo } from './versioning';

// Ordered by newest first
const FILES = [
  { schema: GridFileSchemaV1_3 },
  { schema: GridFileSchemaV1_2, updateFn: upgradeV1_2toV1_3 },
  { schema: GridFileSchemaV1_1, updateFn: upgradeV1_1toV1_2 },
  { schema: GridFileSchemaV1_0, updateFn: upgradeV1_0toV1_1 },
];

// first file version that used Rust to validate
export const firstRustFileVersion = '1.4';

/**
 * Given arbitrary JSON, validate whether it's a valid file format and return
 * the newest format of the file if it is.
 */
export function validateAndUpgradeLegacyGridFile(input: any, logOutput: boolean = true): GridFile | null {
  // First make sure it's a string
  if (typeof input !== 'string') {
    if (logOutput)
      console.error(
        '[validateAndUpgradeLegacyGridFile] Failed to validate and upgrade file. Expected a string, received: %s',
        typeof input
      );
    return null;
  }

  // Then try to convert it to JSON
  let json;
  try {
    json = JSON.parse(input);
  } catch (e) {
    if (logOutput)
      console.error(
        '[validateAndUpgradeLegacyGridFile] Failed to validated and upgrade file. Could not parse input as JSON.',
        e
      );
    return null;
  }

  // rust files are validated by rust
  if (versionGreaterOrEqualTo(json.version, firstRustFileVersion)) {
    return json;
  }

  // older files are validated by TS then Rust
  // Try to validate the file against the newest version, then step back through
  // history for each one that doesn’t validate.
  let isValid = false;
  let errors = [];
  let gridFile;
  for (let index = 0; index < FILES.length; index++) {
    // Validate the file with zod
    const { schema } = FILES[index];
    const result = schema.shape.version.value === '1.0' ? schema.safeParse(preV1_0Fixes(json)) : schema.safeParse(json);
    // If it validates, step through the chain of upgrades to upgrade the file
    // to the latest, then exit the loop
    if (result.success) {
      let upgradeIndex = index;
      gridFile = result.data as GridFiles; // FYI: zod gives us back a deep clone
      while (upgradeIndex !== 0) {
        if (logOutput)
          console.log(
            '[validateAndUpgradeLegacyGridFile] upgrading file version from %s to %s: ',
            gridFile.version,
            FILES[upgradeIndex - 1].schema.shape.version.value
          );
        // @ts-expect-error we know the top one doesn't have an updater function
        gridFile = FILES[upgradeIndex].updateFn(gridFile);
        upgradeIndex--;
      }
      isValid = true;
      break;
    }

    // Otherwise it did't validate, so add the errors to our stack of errors
    // and continue trying
    errors.push({ version: schema.shape.version.value, error: result.error });
  }

  // If it never passed, stop
  if (!isValid) {
    if (logOutput) console.log('[validateAndUpgradeLegacyGridFile] failed to validate file with zod.', errors);
    return null;
  }

  // Upgrade the file to the latest version in Rust
  if (gridFile !== undefined) {
    return gridFile as GridFile;
  } else return null;
}

/**
 * Small fixes we found in pre-v1 files. To be lenient, we make these
 * modifications ourselves directly.
 */
function preV1_0Fixes(jsonFile: any): any {
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
