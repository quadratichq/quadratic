export enum VersionComparisonResult {
  GreaterThan = 1,
  LessThan = -1,
  Equal = 0,
}

/**
 * Takes two version strings and compares whether the first one is greater than,
 * less than, or equal to the second one.
 *
 * Examples:
 *
 * ("1.1", "1.2")  ->  -1 (less than)
 *
 * ("1.1", "1.1")  ->  0 (equal)
 *
 * ("1.10", "1.2") ->  1 (greater than)
 */
export function compareVersions(version1: string, version2: string) {
  const parts1 = version1.split('.').map(Number);
  const parts2 = version2.split('.').map(Number);

  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 < num2) {
      return VersionComparisonResult.LessThan;
    } else if (num1 > num2) {
      return VersionComparisonResult.GreaterThan;
    }
  }

  return VersionComparisonResult.Equal;
}

// Returns true if only the patch version is different
export function isPatchVersionDifferent(version1: string, version2: string): boolean {
  const parts1 = version1.split('.').map(Number);
  const parts2 = version2.split('.').map(Number);

  if (parts1.length !== 3 || parts2.length !== 3) {
    console.error('Invalid version format. Expected format: major.minor.patch', version1, version2);
    return false;
  }

  const [major1, minor1, patch1] = parts1;
  const [major2, minor2, patch2] = parts2;

  if (major1 !== major2 || minor1 !== minor2) {
    return false; // Major or minor versions are different
  }

  return patch1 !== patch2; // Only the patch version is different
}
