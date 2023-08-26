/*

Option 1: only share label + permissions and leave actions to individual spots in code

```
// actions.ts
const deleteFile = {
  label: "Delete",
  permissions: ["OWNER"]
}

// Component.tsx
import { deleteFile } from "./actions";
const MyComponent = () => {
  const { permission } = useRecoilValue(editorInteractionStateAtom);
  return (
    <div>
      {deleteFile.permissions.includes(permissions) && 
        <Button onClick={() => {}}>{deleteFile.label}</Button>}
    </div>
  );
}
```

Option 2: share label + permissions + action via a context

```
// ActionProvider.ts
const ActionContext = createContext({});
const ActionProvider = (props) => {
  const { permission } = props.initialFile;

  const deleteFile = useMemo(() => ({
    label: 'Delete',
    isAvailable: permission === 'OWNER,
    run: (uuid) => {
      if (window.confirm("Please confirm you want to delete this file")) {
        try {
          await apiClient.deleteFile();
          window.location.href = "/files/mine"
        } catch(e) {
          addGlobalSnackbar("Failed to delete file. Try again.", { severity: 'error' });
        }
      }
    } 
  }), [permission]);

  // more actions defined here

  return (
    <ActionContext.Provider value={{ renameFile }}>
      {props.children}
    </ActionContext.Provider>
  );
}
export const useActionContext = () => useContext(ActionContext);


// Then in whatever component you want to use these actions.
// Note: using these necessitate being inside a component, since you need `useActionContext`
const MyComponent = () => {
  const { deleteFile } = useActionContext();
  const { uuid } = useParams();

  return (
    <div>
      {deleteFile.isAvailable && 
        <Button onClick={() => deleteFile.run(uuid)}>
          {deleteFile.label}
        </Button>
      }
  );
}
```

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
