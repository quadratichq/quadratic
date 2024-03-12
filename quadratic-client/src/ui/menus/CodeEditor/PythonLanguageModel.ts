import { IRange, Position, editor, languages } from 'monaco-editor';

export function provideCompletionItems(model: editor.ITextModel, position: Position): languages.CompletionList {
  var textUntilPosition = model.getValueInRange({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  });
  var match = textUntilPosition.match(/cel/);
  if (!match) {
    return { suggestions: [] };
  }
  var word = model.getWordUntilPosition(position);
  var range = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };
  return {
    suggestions: createDependencyProposals(range),
  };
}

function createDependencyProposals(range: IRange | languages.CompletionItemRanges): languages.CompletionItem[] {
  return [
    {
      label: 'cell',
      kind: languages.CompletionItemKind.Function,
      detail: 'Reference a single cell in the grid.',
      documentation: 'Reference a single cell in the grid.',
      insertText: 'cell(x, y)',
      range: range,
    },
    {
      label: 'cells',
      kind: languages.CompletionItemKind.Function,
      detail: 'Reference a multiple cells in the grid.',
      documentation: 'Reference a multiple cells in the grid.',
      insertText: 'cells((x1, y1), (x2, y2))',
      range: range,
    },
    {
      label: 'api_get_2',
      kind: languages.CompletionItemKind.Function,
      detail: 'Reference a multiple cells in the grid.',
      documentation: 'Reference a multiple cells in the grid.',
      insertText: 'cells((x1, y1), (x2, y2))',
      range: range,
    },
    {
      label: 'api_get',
      kind: languages.CompletionItemKind.Snippet,
      detail: 'Get data from an API.',
      documentation: 'Use the fetch API to get data from an API',
      insertText: `import requests 
import pandas as pd 

# Fetch data - replace URL with your API
response = requests.get('https://jsonplaceholder.typicode.com/users')

# Get json response into dataframe
df = pd.DataFrame(response.json())

# Display dataframe to sheet
df`,
      range: range,
    },
  ];
}
