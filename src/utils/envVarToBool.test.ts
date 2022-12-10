import { envVarToBool } from './envVarToBool';

test('envVarToBool', () => {
  expect(envVarToBool('true')).toBe(true);
  expect(envVarToBool('on')).toBe(true);
  expect(envVarToBool('1')).toBe(true);
  expect(envVarToBool('  tRue  ')).toBe(true);
  expect(envVarToBool('ON')).toBe(true);

  expect(envVarToBool('0')).toBe(false);
  expect(envVarToBool('false')).toBe(false);
  expect(envVarToBool('off')).toBe(false);
  expect(envVarToBool('  fAlse  ')).toBe(false);
  expect(envVarToBool('OFF')).toBe(false);

  expect(envVarToBool(undefined)).toBe(false);
});
