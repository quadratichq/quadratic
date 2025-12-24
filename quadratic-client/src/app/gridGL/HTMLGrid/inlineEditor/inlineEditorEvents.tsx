import EventEmitter from 'eventemitter3';
import type { editor } from 'monaco-editor';

interface EventTypes {
  status: (opened: boolean, content?: string) => void;

  replaceText: (text: string, highlight: boolean | number) => void;

  inputFailedValidation: (x: number, y: number, validationId: string) => void;

  valueChanged: (value: string) => void;

  contentChanged: (changes: editor.IModelContentChange[]) => void;
}

export const inlineEditorEvents = new EventEmitter<EventTypes>();
