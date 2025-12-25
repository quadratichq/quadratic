import type { SpanFormatting } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorSpans';
import EventEmitter from 'eventemitter3';
import type { editor } from 'monaco-editor';

interface EventTypes {
  status: (opened: boolean, content?: string) => void;

  replaceText: (text: string, highlight: boolean | number) => void;

  inputFailedValidation: (x: number, y: number, validationId: string) => void;

  valueChanged: (value: string) => void;

  contentChanged: (changes: editor.IModelContentChange[]) => void;

  // Emitted when the selection formatting changes in the inline editor.
  // undefined means no selection or inline editor is closed/in formula mode.
  selectionFormatting: (formatting: SpanFormatting | undefined) => void;
}

export const inlineEditorEvents = new EventEmitter<EventTypes>();
