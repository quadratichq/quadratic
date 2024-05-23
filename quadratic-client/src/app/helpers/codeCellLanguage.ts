import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { Language } from '@/app/ui/components/LanguageIcon';

export const getLanguage = (language?: CodeCellLanguage) => {
  if (typeof language === 'string') {
    return language;
  } else if (typeof language === 'object') {
    return 'Connection';
  }

  return 'Formula';
};

export const getLanguage2 = (language?: CodeCellLanguage): Language => {
  if (typeof language === 'string') {
    return language;
  } else if (typeof language === 'object') {
    return language.Connection.kind;
  }

  return 'Formula';
};

export const matchLanguage = (input: CodeCellLanguage, language: string, kind?: string): boolean => {
  if (typeof input === 'string') {
    return input === language;
  } else if (typeof input === 'object') {
    if (kind) {
      return input.Connection && input.Connection.kind === kind;
    } else {
      return language === 'Connection';
    }
  }

  return false;
};
