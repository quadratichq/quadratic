import { compareVersions } from './compareVersions';

describe('compare version strings', () => {
  test('higher versions return 1', () => {
    expect(compareVersions('1.1', '1.0')).toBe(1);
    expect(compareVersions('1.10', '1.9')).toBe(1);
  });
  test('lower versions return -1', () => {
    expect(compareVersions('1.0', '1.1')).toBe(-1);
    expect(compareVersions('0.9', '1.0')).toBe(-1);
  });
  test('equal versions return 0', () => {
    expect(compareVersions('1.0', '1.0')).toBe(0);
  });
});
