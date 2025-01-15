import { languages } from 'monaco-editor';

export const FormulaLanguageConfig = {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string', 'comment'] },
  ],
} as languages.LanguageConfiguration;

export const FormulaTokenizerConfig = {
  ignore_case: true,

  keywords: [],
  symbols: /[=><!~?:&|+\-*/^%.]+/,
  operators: [
    // Comparison operators
    '=',
    '==',
    '!=',
    '<>',
    '<',
    '>',
    '<=',
    '>=',
    // Mathematical operators
    '+',
    '-',
    '*',
    '/',
    '^',
    '**',
    '<<',
    '>>',
    // Other operators
    '&',
    '..',
    '%',
    ':',
  ],
  tokenizer: {
    root: [
      // cell reference
      [/\$?n?[a-zA-Z]+\$?n?\d+?/, 'cell.reference'],

      [/[a-zA-Z_$][\w$]*/, { cases: { '@keywords': 'keyword', '@default': 'unknown' } }],

      // delimiters and operators
      [/[{}()[\]]/, '@brackets'],
      [/[<>](?!@symbols)/, '@brackets'], // ?! is negative lookahead
      [
        /@symbols/,
        {
          cases: {
            '@operators': 'operator',
            '@default': '',
          },
        },
      ],

      // numbers
      [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],

      // strings (double quote)
      [/"([^"\\]|\\.)*$/, 'string.invalid'], // non-teminated string
      [/"/, { token: 'string.quote', bracket: '@open', next: '@string_double' }],

      // strings (single quote)
      [/'([^'\\]|\\.)*$/, 'string.invalid'], // non-teminated string
      [/'/, { token: 'string.quote', bracket: '@open', next: '@string_single' }],
    ],
    comment: [
      [/[^/*]+/, 'comment'],
      [/\/\*/, 'comment', '@push'],
      ['\\*/', 'comment', '@pop'],
      [/[/*]/, 'comment'],
    ],
    string_double: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop'],
    ],
    string_single: [
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape'],
      [/'/, 'string', '@pop'],
    ],
  },
} as languages.IMonarchLanguage;
