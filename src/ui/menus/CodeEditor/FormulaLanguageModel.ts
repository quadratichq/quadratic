import { languages } from 'monaco-editor';

const keywords = [
  // MATHEMATICS FUNCTIONS
  'SUM',
  'PRODUCT',
  // STATISTICS FUNCTIONS
  'AVERAGE',
  'COUNT',
  'MIN',
  'MAX',
  // LOGIC FUNCTIONS
  'TRUE',
  'FALSE',
  'NOT',
  'AND',
  'OR',
  'XOR',
  'IF',
  // STRING FUNCTIONS
  'CONCAT',
];
export const FormulaLanguageConfig = {
  ignore_case: true,

  keywords,
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
      [/[a-zA-Z_$][\w$]*/, { cases: { '@keywords': 'keyword', '@default': 'variable' } }],

      // cell references
      [/\$?[A-Z]+\$?n?\d+/, ''],

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

function suggestion(label: string, args: string, documentation: string): any {
  return {
    label,
    kind: languages.CompletionItemKind.Function,
    insertText: label + '(' + args + ')',
    insertTextRules: languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation,
  };
}

export const FormulaCompletionProvider = {
  /* eslint-disable no-template-curly-in-string */
  provideCompletionItems: (model, position, context, token) => {
    var suggestions = [
      // Mathematics functions
      suggestion('SUM', '${1:addends}', 'Adds all values. Returns `0` if given no values.'),
      suggestion('PRODUCT', '${1:factors}', 'Multiplies all values. Returns `1` if given no values.'),
      // Statistics functions
      suggestion('AVERAGE', '${1:values}', 'Returns the arithmetic mean of all values.'),
      suggestion('COUNT', '${1:values}', 'Returns the number of nonempty values.'),
      suggestion('MIN', '${1:values}', 'Returns the smallest value. Returns +∞ if given no values.'),
      suggestion('MAX', '${1:values}', 'Returns the largest value. Returns -∞ if given no values.'),
      // Logic functions
      suggestion('TRUE', '', 'Returns `TRUE`.'),
      suggestion('FALSE', '', 'Returns `FALSE`.'),
      suggestion('NOT', '${1:a}', 'Returns `TRUE` if `a` is falsey and `FALSE` if `a` is truthy.'),
      suggestion(
        'AND',
        '${1:a, b, ...}',
        'Returns `TRUE` if all values are truthy and `FALSE` if any values is falsey. Returns `TRUE` if given no values.'
      ),
      suggestion(
        'OR',
        '${1:a, b, ...}',
        'Returns `TRUE` if any value is truthy and `FALSE` if any value is falsey. Returns `FALSE` if given no values.'
      ),
      suggestion(
        'XOR',
        '${1:a, b, ...}',
        'Returns `TRUE` if an odd number of values are truthy and `FALSE` if an even number of values are truthy. Returns `FALSE` if given no values.'
      ),
      suggestion(
        'IF',
        '${1:cond}, ${2:t}, ${3:f}',
        'Returns `t` if `cond` is truthy and `f` if `cond` if falsey.'
      ),
      // String functions
      suggestion('CONCAT', '${1:values}', 'Concatenates all values as strings.'),
    ];
    return { suggestions: suggestions };
  },
} as languages.CompletionItemProvider;
