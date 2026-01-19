import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import type { CodeCellType } from 'quadratic-shared/typesAndSchemasAI';

export const codeCellsById = {
  Formula: { id: 'Formula', label: 'Formula', type: undefined },
  Javascript: { id: 'Javascript', label: 'JavaScript', type: undefined },
  Python: { id: 'Python', label: 'Python', type: undefined },
  Import: { id: 'Import', label: 'Import', type: undefined },
  POSTGRES: { id: 'POSTGRES', label: 'Postgres', type: 'connection' },
  MYSQL: { id: 'MYSQL', label: 'MySQL', type: 'connection' },
  MSSQL: { id: 'MSSQL', label: 'MS SQL Server', type: 'connection' },
  SNOWFLAKE: { id: 'SNOWFLAKE', label: 'Snowflake', type: 'connection' },
  COCKROACHDB: { id: 'COCKROACHDB', label: 'CockroachDB', type: 'connection' },
  BIGQUERY: { id: 'BIGQUERY', label: 'BigQuery', type: 'connection' },
  MARIADB: { id: 'MARIADB', label: 'MariaDB', type: 'connection' },
  SUPABASE: { id: 'SUPABASE', label: 'Supabase', type: 'connection' },
  NEON: { id: 'NEON', label: 'Neon', type: 'connection' },
  MIXPANEL: { id: 'MIXPANEL', label: 'Mixpanel', type: 'connection' },
  GOOGLE_ANALYTICS: { id: 'GOOGLE_ANALYTICS', label: 'Google Analytics', type: 'connection' },
  PLAID: { id: 'PLAID', label: 'Plaid', type: 'connection' },
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

export const getLanguage = (language?: CodeCellLanguage | null): CodeCellType => {
  if (typeof language === 'string') {
    return language;
  } else if (typeof language === 'object') {
    return 'Connection';
  }

  return 'Python';
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
      case 'MSSQL':
        return 'sql';
      case 'SNOWFLAKE':
        return 'sql';
      case 'BIGQUERY':
        return 'sql';
      case 'COCKROACHDB':
        return 'pgsql';
      case 'MARIADB':
        return 'mysql';
      case 'SUPABASE':
        return 'pgsql';
      case 'NEON':
        return 'pgsql';
      case 'MIXPANEL':
        return 'sql';
      case 'GOOGLE_ANALYTICS':
        return 'sql';
      case 'PLAID':
        return 'sql';
    }
  }

  return 'python';
};

export const getConnectionUuid = (language?: CodeCellLanguage): string | undefined => {
  if (typeof language === 'object' && language.Connection) {
    return language.Connection.id;
  }

  return undefined;
};

export const getConnectionInfo = (language?: CodeCellLanguage) => {
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

export const translateLanguageForAI = (language: CodeCellLanguage): string => {
  if (typeof language === 'string') {
    return language;
  } else if (typeof language === 'object') {
    return `a connection cell of type ${language.Connection.kind}`;
  }

  return 'Python';
};

/**
 * Check if a languageId represents a database connection type.
 * This includes both the generic 'Connection' type and specific database connection types.
 */
export const isDatabaseConnection = (languageId?: string): boolean => {
  if (!languageId) return false;
  if (languageId === 'Connection') return true;

  // Check if it's one of the connection types defined in codeCellsById
  const connectionTypes = Object.keys(codeCellsById).filter(
    (key) => codeCellsById[key as CodeCellIds].type === 'connection'
  ) as CodeCellIds[];

  return connectionTypes.includes(languageId as CodeCellIds);
};
