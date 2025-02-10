import { focusGrid } from '@/app/helpers/focusGrid';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import type { Rectangle } from 'pixi.js';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

// todo: ideally, position would be set via ref instead of render so it doesn't
// flicker when renaming heading or table name where the heading is off the
// screen.

interface Props {
  position?: Rectangle;
  defaultValue?: string;
  initialValue?: string;

  // the class name of the input
  className?: string;
  styles?: React.CSSProperties;
  onClose: () => void;
  onSave: (value: string) => void;
  onInput?: (e: React.ChangeEvent<HTMLInputElement>) => void;

  hasBorder?: number;

  selectOnFocus?: boolean;

  // input box should not shrink to fit the text
  noShrink?: boolean;
}

export const PixiRename = (props: Props) => {
  const {
    position,
    defaultValue,
    initialValue,
    className,
    styles,
    onClose,
    onSave,
    onInput,
    hasBorder,
    noShrink,
    selectOnFocus = true,
  } = props;

  const [inputEl, setInputEl] = useState<HTMLInputElement | null>(null);
  const ref = useCallback((node: HTMLInputElement | null) => setInputEl(node), [setInputEl]);
  const skipSaveRef = useRef<boolean>(false);

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

  // focus the input after the position is set
  useEffect(() => {
    if (inputEl) {
      if (selectOnFocus) {
        inputEl.select();
      }
      inputEl.focus();
    }
  }, [inputEl, selectOnFocus]);

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

  const onChange = useCallback(() => {
    if (inputEl) {
      // need to calculate the width of the input using a span with the same css as the input
      const span = document.createElement('span');
      span.className = className ?? '';
      span.style.visibility = 'hidden';
      span.style.whiteSpace = 'pre';
      span.innerText = inputEl.value;
      document.body.appendChild(span);
      inputEl.style.width = noShrink
        ? `${Math.max(span.offsetWidth, position?.width ?? 0 - (hasBorder ? hasBorder / 2 : 0))}px`
        : `${span.offsetWidth}px`;
      document.body.removeChild(span);
    }
  }, [inputEl, className, noShrink, position?.width, hasBorder]);

  // Need to catch the Blur event via useEffect since the Input goes away when
  // the context menu closes (eg, via a click outside the Input)
  useEffect(() => {
    return () => {
      if (!skipSaveRef.current) {
        if (inputEl && inputEl.value !== defaultValue && validate(inputEl.value)) {
          onSave(inputEl.value);
        }
      } else {
        skipSaveRef.current = false;
      }
    };
  }, [defaultValue, inputEl, onSave, validate]);

  if (!position) return null;

  return (
    <Input
      ref={ref}
      className={cn('pointer-events-auto absolute rounded-none border-none outline-none', className)}
      style={{
        left: position.x + (hasBorder ? hasBorder / 2 : 0),
        top: position.y + (hasBorder ? hasBorder / 2 : 0),
        width: position.width - (hasBorder ? hasBorder : 0),
        height: position.height - (hasBorder ? hasBorder : 0),
        ...styles,
      }}
      onKeyDown={onKeyDown}
      onChange={onChange}
      onInput={onInput}
      defaultValue={initialValue ?? defaultValue}
    />
  );
};
