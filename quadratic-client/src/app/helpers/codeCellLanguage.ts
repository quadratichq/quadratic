import { CodeCellLanguage } from '@/app/quadratic-core-types';

export const getLanguage = (language?: CodeCellLanguage) => {
  if (typeof language === 'string') {
    return language;
  } else if (typeof language === 'object') {
    return 'Connection';
  }

  return 'Formula';
};
