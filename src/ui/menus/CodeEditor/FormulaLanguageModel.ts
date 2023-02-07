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

export const FormulaCompletionProvider = {
  provideCompletionItems: (model, position, context, token) => {
    var suggestions = [
      {
        label: 'sum',
        kind: languages.CompletionItemKind.Keyword,
        // eslint-disable-next-line no-template-curly-in-string
        insertText: 'SUM(${1:condition})',
        insertTextRules: languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'SUM stuff.',
      },
    ];
    return { suggestions: suggestions };
  },
} as languages.CompletionItemProvider;
