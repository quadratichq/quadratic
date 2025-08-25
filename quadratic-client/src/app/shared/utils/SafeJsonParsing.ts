import { OBJ, parse, STR } from 'partial-json';

export const parsePartialJson = <T>(args: string): Partial<T> | null => {
  try {
    const parsed = parse(args, STR | OBJ);
    return parsed;
  } catch (error) {
    return null;
  }
};

export const parseFullJson = <T>(args: string): Partial<T> | null => {
  try {
    const json = JSON.parse(args);
    return json;
  } catch (error) {
    console.error('[SetSQLCodeCellValue] Failed to parse args: ', error);
    return null;
  }
};
