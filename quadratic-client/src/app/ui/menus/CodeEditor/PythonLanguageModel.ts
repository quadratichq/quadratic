import { languages } from 'monaco-editor';
import type { IRange, Position, editor } from 'monaco-editor';
import { CompletionItemKind, CompletionTriggerKind, InsertReplaceEdit } from 'vscode-languageserver-protocol';
import type {
  CompletionItem,
  CompletionParams,
  MarkupContent,
  Range,
  TextDocumentContentChangeEvent,
} from 'vscode-languageserver-protocol';

import { pyrightWorker, uri } from '@/app/web-workers/pythonLanguageServer/worker';

export async function provideCompletionItems(
  model: editor.ITextModel,
  position: Position
): Promise<languages.CompletionList> {
  const word = model.getWordUntilPosition(position);
  const lastCharacter = model.getValueInRange({
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: Math.max(1, word.endColumn - 1),
    endColumn: word.endColumn,
  });

  const textDocument: TextDocumentContentChangeEvent[] = [{ text: model.getValue() }];
  pyrightWorker?.changeDocument(uri, textDocument);

  const completionParams: CompletionParams = {
    textDocument: { uri },
    position: { line: position.lineNumber - 1, character: position.column - 1 },
    context: {
      triggerKind: CompletionTriggerKind.TriggerForIncompleteCompletions,
      triggerCharacter: lastCharacter,
    },
  };

  const results = await pyrightWorker?.completionRequest(completionParams);

  return {
    suggestions: results?.items.map((item: CompletionItem) => convertCompletionItem(item, model)) || [],
    incomplete: results?.isIncomplete || true,
    dispose: () => {},
  };
}

export async function provideSignatureHelp(
  model: editor.ITextModel,
  position: Position
): Promise<languages.SignatureHelpResult | undefined> {
  const textDocument: TextDocumentContentChangeEvent[] = [{ text: model.getValue() }];
  pyrightWorker?.changeDocument(uri, textDocument);

  try {
    const signatureHelp = await pyrightWorker?.signatureHelpRequest({
      textDocument: { uri },
      position: {
        line: position.lineNumber - 1,
        character: position.column - 1,
      },
    });

    if (!signatureHelp) return undefined;

    return {
      value: {
        signatures: signatureHelp.signatures.map((signature) => {
          return {
            label: signature.label,
            documentation: signature.documentation,
            parameters: signature.parameters || [],
            activeParameter: signature.activeParameter,
          };
        }),
        activeSignature: signatureHelp.activeSignature || 0,
        activeParameter: signatureHelp.activeParameter || 0,
      },
      dispose: () => {},
    };
  } catch (err) {
    console.warn('Error generating a signature:', err);
  }
}

export async function provideHover(model: editor.ITextModel, position: Position): Promise<languages.Hover | undefined> {
  const textDocument: TextDocumentContentChangeEvent[] = [{ text: model.getValue() }];
  pyrightWorker?.changeDocument(uri, textDocument);

  try {
    const hoverInfo = await pyrightWorker?.hoverRequest({
      textDocument: { uri },
      position: { line: position.lineNumber - 1, character: position.column - 1 },
    });

    if (!hoverInfo || !hoverInfo.range) return undefined;

    return {
      contents: [{ value: (hoverInfo.contents as MarkupContent).value || '' }],
      range: convertRange(hoverInfo.range),
    };
  } catch (err) {
    console.warn('Error generating a hover:', err);
  }
}

function convertCompletionItem(item: CompletionItem, model?: editor.ITextModel): languages.CompletionItem {
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
        range: convertRange(edit.range) as any,
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

function convertCompletionItemKind(itemKind: CompletionItemKind): languages.CompletionItemKind {
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
