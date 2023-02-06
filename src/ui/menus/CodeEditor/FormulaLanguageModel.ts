import { languages } from 'monaco-editor';

const keywords = ['SUM', 'AVERAGE'];
export const FormulaLanguageConfig = {
  keywords,
  tokenizer: {
    root: [[/[a-zA-Z_$][\w$]*/, { cases: { '@keywords': 'keyword', '@default': 'variable' } }]],
    comment: [
      [/[^/*]+/, 'comment'],
      [/\/\*/, 'comment', '@push'],
      ['\\*/', 'comment', '@pop'],
      [/[/*]/, 'comment'],
    ],
    string: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string', '@pop'],
    ],
  },
} as languages.IMonarchLanguage;
