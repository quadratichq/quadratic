import { Position, editor, languages } from 'monaco-editor';
// import { createConverter as createProtocolConverter } from 'vscode-languageclient/lib/common/protocolConverter';
import { CompletionParams, CompletionTriggerKind, TextDocumentContentChangeEvent } from 'vscode-languageserver-protocol';
import { pyrightWorker, uri } from './language-server/worker';

// import vscode from 'vscode';
// declare module 'vscode' {
//   export function createConverter(): any;
// }

// const protocolConverter = createProtocolConverter(undefined, true, true);

export async function provideCompletionItems(model: editor.ITextModel, position: Position): Promise<languages.CompletionList> {
  // const textUntilPosition = model.getValueInRange({
  //   startLineNumber: 1,
  //   startColumn: 1,
  //   endLineNumber: position.lineNumber,
  //   endColumn: position.column,
  // });

  // const match = textUntilPosition.match(/cel/);
  // if (!match) {
  //   return { suggestions: [] };
  // }
  const word = model.getWordUntilPosition(position);
  const lastCharacter = model.getValueInRange({
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: Math.max(1, word.endColumn - 1),
    endColumn: word.endColumn,
  });

  // assume the word is on a single line
  // const rangeWord = {
  //   startLineNumber: position.lineNumber,
  //   endLineNumber: position.lineNumber,
  //   startColumn: word.startColumn,
  //   endColumn: word.endColumn,
  // };

  // let triggerKind: CompletionTriggerKind | undefined;
  //       let triggerCharacter: string | undefined;
  //       const before = context.matchBefore(identifierLike);
  //       if (context.explicit || before) {
  //         triggerKind = CompletionTriggerKind.Invoked;
  //       } else {
  //         const triggerCharactersRegExp = createTriggerCharactersRegExp(client);
  //         const match =
  //           triggerCharactersRegExp &&
  //           context.matchBefore(triggerCharactersRegExp);
  //         if (match) {
  //           triggerKind = CompletionTriggerKind.TriggerCharacter;
  //           triggerCharacter = match.text;
  //         } else {
  //           return null;
  //         }
  //       }


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
  console.log('completionParams', completionParams);
  pyrightWorker?.completionRequest(completionParams).then((result) => {console.log('result', result)});

  const results = await pyrightWorker?.completionRequest(completionParams);


  // return (protocolConverter?.asCompletionResult(results) || []) as unknown as languages.CompletionList;

  return {
    suggestions: results?.items ?? [],
    incomplete: results?.isIncomplete ?? false,
  } as languages.CompletionList;

  // return {
  //   suggestions: createDependencyProposals(rangeWord),
  // };
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
