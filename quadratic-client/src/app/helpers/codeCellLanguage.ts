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
