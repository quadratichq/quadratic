import { IRange, Position, editor, languages } from 'monaco-editor';
import { createConverter as createProtocolConverter } from 'vscode-languageclient/lib/common/protocolConverter';
import { CancellationToken, CompletionItem, CompletionItemKind, CompletionParams, CompletionTriggerKind, InsertReplaceEdit, Range, TextDocumentContentChangeEvent } from 'vscode-languageserver-protocol';
import { pyrightWorker, uri } from './language-server/worker';


const protocolConverter = createProtocolConverter(undefined, true, true);

export async function provideCompletionItems(model: editor.ITextModel, position: Position): Promise<languages.CompletionList> {
  const word = model.getWordUntilPosition(position);
  const lastCharacter = model.getValueInRange({
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: Math.max(1, word.endColumn - 1),
    endColumn: word.endColumn,
  });

  const textDocument: TextDocumentContentChangeEvent[] = [{ text: model.getValue() }];
  pyrightWorker?.didChangeTextDocument(uri, textDocument);

  const completionParams: CompletionParams = {
    textDocument: {
      uri,
    },
    position: {line: position.lineNumber - 1, character: position.column - 1},
    context: {
      triggerKind: CompletionTriggerKind.TriggerForIncompleteCompletions,
      triggerCharacter: lastCharacter,
    },
  };

  const completionList = await pyrightWorker?.completionRequest(completionParams);
  const results = await protocolConverter?.asCompletionResult(completionList);

  return {
    suggestions: results.items.map((item: CompletionItem) => convertCompletionItem(item, model)),
    incomplete: results.isIncomplete,
    dispose: () => {},
  };
}

function convertCompletionItem(
  item: CompletionItem,
  model?: editor.ITextModel
): languages.CompletionItem {
  const converted: languages.CompletionItem = {
      label: item.label,
      kind: convertCompletionItemKind(item.kind as any),
      tags: item.tags,
      detail: item.detail,
      documentation: item.documentation,
      sortText: item.sortText,
      filterText: item.filterText,
      preselect: item.preselect,
      insertText: item.label,
      range: undefined as any,
  };

  if (item.textEdit) {
      converted.insertText = item.textEdit.newText;
      if (InsertReplaceEdit.is(item.textEdit)) {
          converted.range = {
              insert: convertRange(item.textEdit.insert),
              replace: convertRange(item.textEdit.replace),
          };
      } else {
          converted.range = convertRange(item.textEdit.range);
      }
  }

  if (item.additionalTextEdits) {
      converted.additionalTextEdits = item.additionalTextEdits.map((edit) => {
          return {
              range: convertRange(edit.range),
              text: edit.newText,
          };
      });
  }

  // Stash a few additional pieces of information.
  (converted as any).__original = item;
  if (model) {
      (converted as any).model = model;
  }

  return converted;
}

function convertCompletionItemKind(
  itemKind: CompletionItemKind
): languages.CompletionItemKind {
  switch (itemKind) {
      case CompletionItemKind.Constant:
          return languages.CompletionItemKind.Constant;

      case CompletionItemKind.Variable:
          return languages.CompletionItemKind.Variable;

      case CompletionItemKind.Function:
          return languages.CompletionItemKind.Function;

      case CompletionItemKind.Field:
          return languages.CompletionItemKind.Field;

      case CompletionItemKind.Keyword:
          return languages.CompletionItemKind.Keyword;

      default:
          return languages.CompletionItemKind.Reference;
  }
}

function convertRange(range: Range): IRange {
  return {
      startLineNumber: range.start.line + 1,
      startColumn: range.start.character + 1,
      endLineNumber: range.end.line + 1,
      endColumn: range.end.character + 1,
  };
}

export async function resolveCompletionItem(item: languages.CompletionItem, token: CancellationToken): Promise<languages.CompletionItem> {
  const range = {
    startLineNumber: 0,
    endLineNumber: 0,
    startColumn: 0,
    endColumn: 1,
  };

  console.log("item", item);
  console.log("token", token);

  return {
          label: 'cell',
          kind: languages.CompletionItemKind.Function,
          detail: 'Reference a single cell in the grid.',
          documentation: 'Reference a single cell in the grid.',
          insertText: 'cell(x, y)',
          range,
        };
}

// function createDependencyProposals(range: IRange | languages.CompletionItemRanges): languages.CompletionItem[] {
//   return [
//     {
//       label: 'cell',
//       kind: languages.CompletionItemKind.Function,
//       detail: 'Reference a single cell in the grid.',
//       documentation: 'Reference a single cell in the grid.',
//       insertText: 'cell(x, y)',
//       range: range,
//     },
//     {
//       label: 'cells',
//       kind: languages.CompletionItemKind.Function,
//       detail: 'Reference a multiple cells in the grid.',
//       documentation: 'Reference a multiple cells in the grid.',
//       insertText: 'cells((x1, y1), (x2, y2))',
//       range: range,
//     },
//   ];
// }
