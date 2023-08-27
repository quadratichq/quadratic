/*

Option 1: Define everything you can statically (label + permissions) and
leave calculating them to runtime actions. Associated actions also has to be run
in each individual spot.

Benefit:

- Static definitions, can be imported and used anywhere, even outside react components
- Leaves logic for action up to invocation spot, making it more extensible
- Could in theory be shared with Dashboard

Drawbacks:

- Leaves logic for action up to invocation spot, making exact consistency difficult to impossible (not DRY)

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
      {deleteFile.permissions.includes(permission) && 
        <Button onClick={() => {}}>{deleteFile.label}</Button>}
    </div>
  );
}
```

Option 2: Define and calculate everything associated with an action (label + permissions + action)
in a React context. Use the same actions everywhere.

Benefits:

- Centralized action names, permission checks, and logic all calculated once at initialization
- Guarantees consistency

Drawbacks:

- Makes custom action UX given invocation location difficult, nearly impossible (maybe this is ok, even desired?)
- Probably can't be shared with dashboard

```
// ActionProvider.ts
const ActionContext = createContext({});
const ActionProvider = (props) => {
  const { permission } = props.initialFile;

  const deleteFile = useMemo(() => ({
    label: 'Delete',
    isAvailable: permission === 'OWNER',
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
