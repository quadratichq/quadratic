import { validateAndUpgradeLegacyGridFile } from '@/app/schemas/validateAndUpgradeLegacyGridFile';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

/**
 * Given arbitrary JSON, validate whether it's a valid file format and return
 * the newest format of the file if it is.
 */
export async function validateAndUpgradeGridFile(
  input: any,
  logOutput: boolean = true
): Promise<{
  contents: string;
  version: string;
} | null> {
  let file = validateAndUpgradeLegacyGridFile(input, logOutput);
  if (file === null) return null;

  // There cannot be a sequence_num before v1.5
  const results = await quadraticCore.upgradeGridFile(JSON.stringify(file), 0);
  return { contents: results.grid, version: results.version };
}
