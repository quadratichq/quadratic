import { describe, expect, test } from 'vitest';
import { VersionComparisonResult, compareVersions, isPatchVersionDifferent } from './compareVersions';

describe('compare version strings', () => {
  test('higher versions return 1', () => {
    expect(compareVersions('1.1', '1.0')).toBe(VersionComparisonResult.GreaterThan);
    expect(compareVersions('1.10', '1.9')).toBe(VersionComparisonResult.GreaterThan);
  });
  test('lower versions return -1', () => {
    expect(compareVersions('1.0', '1.1')).toBe(VersionComparisonResult.LessThan);
    expect(compareVersions('0.9', '1.0')).toBe(VersionComparisonResult.LessThan);
  });
  test('equal versions return 0', () => {
    expect(compareVersions('1.0', '1.0')).toBe(VersionComparisonResult.Equal);
  });
});

describe('isPatchVersionDifferent', () => {
  test('returns true if the patch version is different', () => {
    expect(isPatchVersionDifferent('1.0.0', '1.0.1')).toBe(true);
    expect(isPatchVersionDifferent('1.2.0', '1.3.0')).toBe(false);
  });
});
