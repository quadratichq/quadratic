import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/shadcn/ui/alert-dialog';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useState } from 'react';

// 1. Required dialog options
type ConfirmOptions = {
  title: string;
  message: string;
  confirmText: string;
};

// 2. Keys and required args for each dialog type
type ConfirmDialogArgs = {
  deleteConnection: undefined;
  deleteUserFromTeam: { name: string; isLoggedInUser: boolean };
  deleteUserFromFile: { name: string; isLoggedInUser: boolean };
  deleteDemoConnection: undefined;
};
type ConfirmDialogKeys = keyof ConfirmDialogArgs;

// 3. Dialog registry (centralized verbiage and structure)
const confirmDialogs: {
  [K in ConfirmDialogKeys]: (args: ConfirmDialogArgs[K]) => ConfirmOptions;
} = {
  deleteConnection: () => ({
    title: 'Delete connection',
    message: `The connection will be deleted if you continue. This cannot be undone.`,
    confirmText: 'Delete',
  }),
  deleteUserFromTeam: ({ name, isLoggedInUser }) => ({
    title: isLoggedInUser ? 'Leave team' : 'Remove user from team',
    message: isLoggedInUser
      ? `Any of your private files will be made publicly available to the team if you continue.`
      : `${name} will be removed from the team and any of their private files will be made publicly available to the team if you continue.`,
    confirmText: isLoggedInUser ? 'Leave' : 'Remove',
  }),
  deleteUserFromFile: ({ name, isLoggedInUser }) => ({
    title: isLoggedInUser ? 'Leave file' : 'Remove user from file',
    message: isLoggedInUser
      ? `You will lose your invited access to the file if you continue.`
      : `${name} will lose their invited access to this file if you continue.`,
    confirmText: isLoggedInUser ? 'Leave' : 'Remove',
  }),
  deleteDemoConnection: () => ({
    title: 'Remove demo connection',
    message:
      'This connection will no longer be visible to your team. However, any files that reference it will still connect successfully.',
    confirmText: 'Remove',
  }),
};

// 4. Internal confirm function type
type InternalConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

// 5. Context
const ConfirmContext = createContext<InternalConfirmFn | null>(null);

// 6. useConfirm hook (typed, requires args)
export function useConfirmDialog<T extends ConfirmDialogKeys>(
  key: T,
  args: ConfirmDialogArgs[T]
): () => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  const options = confirmDialogs[key](args);
  return () => ctx(options);
}

// 7. Provider
// By default, the confirm dialog is destructive. We really shouldn't be asking
// for confirmation to do something that isn't destructive and non-reversible.
export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvePromise, setResolvePromise] = useState<(val: boolean) => void>(() => {});
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const confirm: InternalConfirmFn = useCallback((opts) => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise((resolve) => {
      setResolvePromise(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    setOptions(null);
    resolvePromise(true);
  }, [resolvePromise]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    setOptions(null);
    resolvePromise(false);
  }, [resolvePromise]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options?.title}</AlertDialogTitle>
            <AlertDialogDescription>{options?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} variant="destructive">
              {options?.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
};
