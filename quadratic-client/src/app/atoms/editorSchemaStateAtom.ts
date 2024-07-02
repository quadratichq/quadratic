import { atom } from 'recoil';
import { SchemaData } from '../ui/connections/SchemaViewer';

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
