import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { validateAndUpgradeLegacyGridFile } from './validateAndUpgradeLegacyGridFile';

/**
 * Given arbitrary JSON, validate whether it's a valid file format and return
 * the newest format of the file if it is.
 */
export async function validateAndUpgradeGridFile(
  input: any,
  logOutput: boolean = true
): Promise<{
  contents: Uint8Array;
  version: string;
} | null> {
  let file = validateAndUpgradeLegacyGridFile(input, logOutput);
  if (file === null) return null;

  const stringified = JSON.stringify(file);
  const buffer = Buffer.from(stringified, 'utf8');

  // There cannot be a sequence_num before v1.5
  const results = await quadraticCore.upgradeGridFile(buffer, 0);
  return { contents: results.grid, version: results.version };
}
