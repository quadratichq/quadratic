import { CodeCellLanguage } from '@/app/quadratic-core-types';

const codeCellsById = {
  Formula: { id: 'Formula', label: 'Formula' },
  Javascript: { id: 'Javascript', label: 'JavaScript' },
  Python: { id: 'Python', label: 'Python' },
  POSTGRES: { id: 'POSTGRES', label: 'Postgres', type: 'connection' },
  MYSQL: { id: 'MYSQL', label: 'MySQL', type: 'connection' },
} as const;
export type CodeCellIds = keyof typeof codeCellsById;
// type CodeCell = (typeof codeCellsById)[CodeCellIds];

export const codeCellIsAConnection = (language?: CodeCellLanguage) => {
  const cell = getCodeCell(language);
  return cell && 'type' in cell && cell.type === 'connection';
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

export const getLanguageForMonaco = (language?: CodeCellLanguage): string => {
  const supportedLanguage = getLanguage(language);

  if (supportedLanguage === 'Connection') {
    return 'Sql';
  }

  return supportedLanguage;
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
