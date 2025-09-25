import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import type { FocusEvent, JSX, KeyboardEvent, Ref } from 'react';
import { forwardRef, useCallback, useEffect, useRef } from 'react';

interface ValidationInputProps {
  className?: string;

  label?: string;
  value?: string;
  error?: string;
  disabled?: boolean;

  // used to update whenever the input loses focus
  onChange?: (value: string) => void;

  // used to update whenever the input is changed (ie, a character is changes within the input box)
  onInput?: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onEnter?: (value: string) => void;

  footer?: string | JSX.Element;
  height?: string;
  placeholder?: string;

  readOnly?: boolean;

  type?: 'number';

  // clears the input value when toggling to true
  clear?: boolean;

  testId?: string;
}

export const ValidationInput = forwardRef((props: ValidationInputProps, ref: Ref<HTMLInputElement>) => {
  const {
    className,
    label,
    value,
    error,
    disabled,
    onChange,
    onInput,
    onEnter,
    footer,
    height,
    placeholder,
    readOnly,
    type,
    clear,
    onKeyDown,
    testId,
  } = props;

  const parentRef = useRef<HTMLDivElement>(null);

  const handleOnBlur = useCallback(
    (e: FocusEvent<HTMLDivElement>) => {
      if (onChange) {
        const input = parentRef.current?.querySelector('input');
        if (!input) {
          throw new Error('Expected input to be present in ValidationInput');
        }
        onChange(input.value);
      }
    },
    [onChange]
  );

  const handleOnFocus = useCallback((e: FocusEvent<HTMLDivElement>) => {
    // change the focus from the div to the input on focus
    const input = parentRef.current?.querySelector('input');
    if (!input) {
      throw new Error('Expected input to be present in ValidationInput');
    }
    input.focus();
  }, []);

  // force the value to change when the defaultValue changes (avoids having to
  // have an onChange handler as well)
  useEffect(() => {
    const input = parentRef.current?.querySelector('input');
    if (!input) {
      throw new Error('Expected input to be present in ValidationInput');
    }
    input.value = value ?? '';
  }, [value, clear]);

  return (
    <div>
      {label && <div className={disabled ? 'opacity-50' : ''}>{label}</div>}
      <div ref={parentRef} onBlur={handleOnBlur} onFocus={handleOnFocus} tabIndex={0}>
        <div className={cn('flex w-full items-center space-x-2', error ? 'border border-red-500' : '')}>
          <Input
            className={className}
            ref={ref}
            defaultValue={value}
            onInput={onInput ? (e) => onInput(e.currentTarget.value) : undefined}
            style={{ height }}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            type={type}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onEnter) {
                if (value !== e.currentTarget.value) {
                  onInput?.(e.currentTarget.value);
                  onChange?.(e.currentTarget.value);
                }

                // timeout is needed to ensure the state updates before the onEnter function is called
                const savedValue = e.currentTarget.value;
                setTimeout(() => onEnter?.(savedValue), 0);
                e.preventDefault();
                e.stopPropagation();
              }
              onKeyDown?.(e);
            }}
            data-testid={testId}
          />
        </div>
        {footer && <div className="text-xs">{footer}</div>}
        {error && <div className="text-xs text-red-500">{error}</div>}
      </div>
    </div>
  );
});
