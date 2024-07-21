import { CodeCellLanguage } from '@/app/quadratic-core-types';

const codeCellsById = {
  Formula: { id: 'Formula', label: 'Formula', type: undefined },
  Javascript: { id: 'Javascript', label: 'JavaScript', type: undefined },
  Python: { id: 'Python', label: 'Python', type: undefined },
  POSTGRES: { id: 'POSTGRES', label: 'Postgres', type: 'connection' },
  MYSQL: { id: 'MYSQL', label: 'MySQL', type: 'connection' },
} as const;
export type CodeCellIds = keyof typeof codeCellsById;
// type CodeCell = (typeof codeCellsById)[CodeCellIds];

export const codeCellIsAConnection = (language?: CodeCellLanguage) => {
  const cell = getCodeCell(language);
  return Boolean(cell && 'type' in cell && cell.type === 'connection');
};

export const getCodeCell = (language?: CodeCellLanguage) => {
  let id: CodeCellIds | undefined = undefined;
  if (typeof language === 'string') {
    id = language;
  } else if (typeof language === 'object') {
    id = language.Connection.kind;
  }

  if (id && codeCellsById[id]) {
    return codeCellsById[id];
  }

  return undefined;
};

export const getLanguage = (language?: CodeCellLanguage) => {
  if (typeof language === 'string') {
    return language;
  } else if (typeof language === 'object') {
    return 'Connection';
  }

  return 'Formula';
};

// For languages that monaco supports, see https://github.com/microsoft/monaco-editor/tree/c321d0fbecb50ab8a5365fa1965476b0ae63fc87/src/basic-languages
// note: the language id is case-insensitive
export const getLanguageForMonaco = (language?: CodeCellLanguage): string => {
  if (typeof language === 'string') {
    return language.toLowerCase();
  } else if (typeof language === 'object') {
    switch (language.Connection.kind) {
      case 'POSTGRES':
        return 'pgsql';
      case 'MYSQL':
        return 'mysql';
    }
  }

  return 'formula';
};

export const getConnectionUuid = (language?: CodeCellLanguage): string | undefined => {
  if (typeof language === 'object' && language.Connection) {
    return language.Connection.id;
  }

  return undefined;
};

export const getConnectionInfo = (language?: CodeCellLanguage): { id: string; kind: string } | undefined => {
  if (typeof language === 'object' && language.Connection) {
    return language.Connection;
  }

  return undefined;
};

export const getConnectionKind = (language?: CodeCellLanguage): string | undefined => {
  if (typeof language === 'object' && language.Connection) {
    return language.Connection.kind;
  }

  if (typeof language === 'string') {
    return language;
  }

  return undefined;
};
