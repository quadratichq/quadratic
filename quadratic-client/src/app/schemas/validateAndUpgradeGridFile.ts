import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

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
  let buffer = new Uint8Array(input);
  const results = await quadraticCore.upgradeGridFile(buffer, 0);

  return { contents: results.grid, version: results.version };
}
