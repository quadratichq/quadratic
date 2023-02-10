import { languages } from 'monaco-editor';

const keywords = [
  // MATHEMATICAL OPERATORS
  'SUM',
  'PRODUCT',
  // LOGIC FUNCTIONS
  'TRUE',
  'FALSE',
  'NOT',
  'AND',
  'OR',
  'XOR',
  'IF',
  // STATISTICS FUNCTIONS
  'AVERAGE',
  'COUNT',
  'MIN',
  'MAX',
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
      // Mathematical operators
      suggestion('SUM', '${1:addends}', 'Adds multiple values together'),
      suggestion('PRODUCT', '${1:factors}', 'Multiplies multiple values together'),
      // Logic functions
      suggestion('TRUE', '', 'Returns TRUE (1)'),
      suggestion('FALSE', '', 'Returns FALSE (0)'),
      suggestion('NOT', '${1:arguments}', 'Logically inverts each argument'),
      suggestion(
        'AND',
        '${1:arguments}',
        'Returns TRUE if all arguments are truthy, or FALSE if any argument is falsey'
      ),
      suggestion(
        'OR',
        '${1:arguments}',
        'Returns TRUE if any arguments is truthy, or FALSE if all arguments are falsey'
      ),
      suggestion(
        'XOR',
        '${1:arguments}',
        'Returns TRUE if an odd number of arguments are truthy, or FALSE if an even number of arguments are truthy'
      ),
      suggestion(
        'IF',
        '${1:condition}, ${2:value_if_true}, ${3:value_if_false}',
        'If the first argument is truthy, returns the second argument; otherwise returns the third argument'
      ),
      // Statistics functions
      suggestion('AVERAGE', '${1:values}', 'Returns the arithmetic mean of multiple values'),
      suggestion('COUNT', '${1:values}', 'Returns the number of values present'),
      suggestion('MIN', '${1:values}', 'Returns the minimum value'),
      suggestion('MAX', '${1:values}', 'Returns the maximum value'),
      // String functions
      suggestion('CONCAT', '${1:values}', 'Concatenates multiple values'),
    ];
    return { suggestions: suggestions };
  },
} as languages.CompletionItemProvider;
