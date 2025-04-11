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
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

const initialOptions: ConfirmOptions = {
  title: 'Confirm',
  message: 'Please confirm that you want to complete this action.',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
};

type ConfirmFn = (options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvePromise, setResolvePromise] = useState<(val: boolean) => void>(() => () => {});
  const [options, setOptions] = useState<ConfirmOptions>(initialOptions);

  // Reset options when the dialog is closed
  useEffect(() => {
    if (isOpen === false) {
      setOptions(initialOptions);
    }
  }, [isOpen]);

  const confirm: ConfirmFn = useCallback((opts) => {
    setOptions(opts ?? initialOptions);
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolvePromise(() => resolve);
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    resolvePromise(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolvePromise(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options.title ?? 'Confirm'}</AlertDialogTitle>
            <AlertDialogDescription>
              {options.message ?? 'Please confirm that you want to complete this action.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>{options.cancelText ?? 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>{options.confirmText ?? 'Ok'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
};
