import { SchemaData } from '@/app/ui/menus/CodeEditor/useSchemaData';
import { atom } from 'recoil';

export interface EditorSchemaState {
  schema?: SchemaData;
}

export const editorSchemaStateDefault: EditorSchemaState = {
  schema: undefined,
};

export const editorSchemaStateAtom = atom({
  key: 'editorSchemaState', // unique ID (with respect to other atoms/selectors)
  default: editorSchemaStateDefault,
});
