import { focusGrid } from '@/app/helpers/focusGrid';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  defaultValue?: string;
  initialValue?: string;
  width?: number;

  // the class name of the input
  className?: string;
  styles?: React.CSSProperties;
  onClose: () => void;
  onSave: (value: string) => void;
  onInput?: (e: React.ChangeEvent<HTMLInputElement>) => void;

  getElement: (element: HTMLInputElement) => void;
}

export const PixiRename = (props: Props) => {
  const { defaultValue, initialValue, width, className, styles, onClose, onSave, onInput, getElement } = props;

  const [inputEl, setInputEl] = useState<HTMLInputElement | null>(null);

  const skipSaveRef = useRef<boolean>(false);

  // used to skip the initial blur event after rename starts
  const waitingForOpenRef = useRef<boolean>(true);

  const ref = useCallback(
    (node: HTMLInputElement | null) => {
      setInputEl(node);
      if (node) {
        getElement?.(node);
        setTimeout(() => {
          node.focus();
          waitingForOpenRef.current = false;
        });
      }
    },
    [getElement]
  );

  const close = useCallback(() => {
    onClose();
    focusGrid();
  }, [onClose]);

  // Validates the input value.
  const validate = useCallback((value: string): boolean => {
    if (value.trim().length === 0) {
      return false;
    }
    return true;
  }, []);

  const saveAndClose = useCallback(() => {
    if (inputEl?.value !== defaultValue && validate(inputEl?.value ?? '')) {
      onSave(inputEl?.value ?? '');
      skipSaveRef.current = true;
    }
    close();
  }, [close, defaultValue, inputEl?.value, onSave, validate]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        skipSaveRef.current = true;
        close();
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        saveAndClose();
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [close, saveAndClose]
  );

  // Need to catch the Blur event via useEffect since the Input goes away when
  // the context menu closes (eg, via a click outside the Input)
  useEffect(() => {
    return () => {
      if (waitingForOpenRef.current) return;
      if (!skipSaveRef.current) {
        if (inputEl) {
          if (inputEl.value !== defaultValue && validate(inputEl.value)) {
            onSave(inputEl.value);
          } else {
            close();
          }
        }
      } else {
        skipSaveRef.current = false;
      }
    };
  }, [close, defaultValue, inputEl, onSave, validate]);

  return (
    <Input
      ref={ref}
      className={cn('pointer-events-auto absolute rounded-none border-none outline-none', className)}
      style={{ width, ...styles }}
      spellCheck={false}
      onKeyDown={onKeyDown}
      onInput={onInput}
      defaultValue={initialValue ?? defaultValue}
    />
  );
};
