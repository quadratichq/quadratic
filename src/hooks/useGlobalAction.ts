/*
Usage example:

```
function MyComponent() {
  const { duplicateFile } = useAction();

  return (
    <div>
      {duplicateFile.isAvailable &&
        <Button onClick={() => duplicateFile.run()}>{duplicateFile.label}</Button>
      }
    </div>
  );
}
```

Important on this design: these are the actions for _within_ the app.
Actions from the Dashboard are handled separately, though they may use the same
underlying code from other functions like the `apiClient`.

Why? Because permissions aren't important there (we know who the user is on the dashboard)
and actions are handled differently in that context, with fetchers and the like,
whereas the app is more client-first and changes are synced, the dashboard is optimistic 
with some actions being fully async.

In the future we might be able to achieve the same with fetchers, but perhaps this
is a good-enough abstraction for now.
*/

import { Dispatch, SetStateAction, useMemo } from 'react';
import { useSubmit } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { apiClient } from '../api/apiClient';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { ROUTES } from '../constants/routes';
import { downloadFileInBrowser } from '../helpers/downloadFileInBrowser';
import { GridFileSchema } from '../schemas';
import { useFileContext } from '../ui/components/FileProvider';

type Action = {
  label: string;
  isAvailable: Boolean;
  run: Function;
  shortcut?: string;
};

export function useActions() {
  const { name, contents } = useFileContext();
  const submit = useSubmit();
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { permission } = editorInteractionState;

  const renameFile = useMemo(() => {
    return {
      label: 'Rename',
      isAvailable: permission === 'OWNER' || permission === 'EDITOR',
      run: (fn: () => Dispatch<SetStateAction<string>>) => fn(),
    };
  }, [permission]);

  // Triggers a submission on the main app file and thus triggers the navigation.state === 'loading'
  const duplicateFile = useMemo(() => {
    return {
      label: 'Duplicate',
      isAvailable: permission === 'OWNER' || permission === 'EDITOR' || permission === 'VIEWER',
      run: () => {
        let formData = new FormData();
        formData.append('name', name + ' (Copy)');
        formData.append('contents', JSON.stringify(contents));
        formData.append('version', GridFileSchema.shape.version.value);
        submit(formData, { method: 'POST', action: ROUTES.CREATE_FILE });
      },
    };
  }, [permission, name, contents, submit]);

  const downloadFile = useMemo(() => {
    return {
      label: 'Download local copy',
      isAvailable: permission === 'OWNER' || permission === 'EDITOR' || permission === 'VIEWER',
      run: () => {
        downloadFileInBrowser(name, JSON.stringify(contents));
      },
    };
  }, []);

  // TODO how to communicate async state?
  const deleteFile = useMemo(() => {
    return {
      label: 'Delete',
      isAvailable: permission === 'OWNER',
      run: async (uuid: string, callback: any) => {
        if (window.confirm(`Please confirm you want to delete the file: “${name}”`)) {
          try {
            await apiClient.deleteFile(uuid);
            window.location.href = ROUTES.FILES;
          } catch (e) {
            // addGlobalSnackbar('Failed to delete file. Try again.', { severity: 'error' });
          }
        }
      },
    };
  }, []);

  const newFile = useMemo(() => {
    return {
      label: 'New',
      isAvailable: permission === 'OWNER' || permission === 'EDITOR' || permission === 'VIEWER',
      run: () => {
        // apiClient.createFile()
      },
    };
  }, []);

  return { renameFile, duplicateFile, downloadFile, deleteFile, newFile };
}
