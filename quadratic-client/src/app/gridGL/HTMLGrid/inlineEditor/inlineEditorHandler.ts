import { editor } from 'monaco-editor';

class InlineEditorHandler {
  attach(div: HTMLDivElement) {
    editor.create(div, {
      value: '',
    });
  }
}

export const inlineEditorHandler = new InlineEditorHandler();
