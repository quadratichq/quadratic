/*

Usage:

import { renameFile } from "./actions";

const MyComponent() {
  <div>
    {renameFile.permissions.includes(permissions) && 
      <Button onClick={() => setState()}>{renameFile.label}</Button>}
  </div>
}

*/

type Action = {
  label: string;
  permissions: string[]; // TODO
  shortcutKey?: string;
  shortcutModifiers?: string[];
  action?: Function;
};

export const createFile: Action = {
  label: 'New',
  permissions: ['OWNER', 'EDITOR', 'VIEWER'],
};

export const renameFile: Action = {
  label: 'Rename',
  permissions: ['OWNER', 'EDITOR'],
};

export const duplicateFile = {
  label: 'Duplicate',
  permissions: ['OWNER', 'EDITOR', 'VIEWER'],
};

export const downloadFile = {
  label: 'Download local copy',
  permissions: ['OWNER', 'EDITOR', 'VIEWER'],
};

export const deleteFile = {
  label: 'Delete',
  permissions: ['OWNER'],
};

export const provideFeedback = {
  label: 'Feedback',
  permissions: ['OWNER', 'EDITOR', 'VIEWER'],
};

export const clipboardCut = {
  label: 'Cut',
  permissions: ['OWNER', 'EDITOR'],
};

export const clipboardPaste = {
  label: 'Paste',
  permissions: ['OWNER', 'EDITOR'],
};

export const historyUndo = {
  label: 'Undo',
  permissions: ['OWNER', 'EDITOR'],
};

export const historyRedo = {
  label: 'Undo',
  permissions: ['OWNER', 'EDITOR'],
};
