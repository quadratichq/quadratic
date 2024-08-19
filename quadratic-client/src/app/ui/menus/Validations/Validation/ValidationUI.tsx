import { Checkbox } from '@/shared/shadcn/ui/checkbox';
import { ValidationData } from './useValidationData';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { FocusEvent, forwardRef, Ref, useCallback, useEffect, useRef, useState } from 'react';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { cn } from '@/shared/shadcn/utils';
import { IconButton } from '@mui/material';
import { Close } from '@mui/icons-material';

interface CheckboxProps {
  className?: string;
  label: string;
  value: boolean;
  changeValue: (checked: boolean) => void;
  readOnly?: boolean;
}

export const ValidationUICheckbox = (props: CheckboxProps) => {
  const { label, value: showDropdown, changeValue: changeDropDown, readOnly, className } = props;

  return (
    <div className={`${className ?? ''} flex items-center space-x-2`}>
      <Checkbox id={label} checked={showDropdown} onCheckedChange={changeDropDown} disabled={readOnly} />
      <label htmlFor={label} className="cursor-pointer text-sm font-medium">
        {label}
      </label>
    </div>
  );
};

interface InputProps {
  className?: string;

  label?: string;
  value?: string;
  error?: string;
  disabled?: boolean;

  // used to update whenever the input loses focus
  onChange?: (value: string) => void;

  // used to update whenever the input is changed (ie, a character is changes within the input box)
  onInput?: (value: string) => void;

  onEnter?: () => void;

  footer?: string | JSX.Element;
  height?: string;
  placeholder?: string;

  readOnly?: boolean;

  type?: 'number';

  showOnFocus?: JSX.Element;
}

export const ValidationInput = forwardRef((props: InputProps, ref: Ref<HTMLInputElement>) => {
  const {
    label,
    value,
    onChange,
    onInput,
    footer,
    height,
    placeholder,
    error,
    disabled,
    readOnly,
    type,
    onEnter,
    className,
    showOnFocus,
  } = props;

  const parentRef = useRef<HTMLDivElement>(null);

  const [hasFocus, setHasFocus] = useState(false);

  const handleOnBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(e.currentTarget.value);
      }

      if (!parentRef.current?.contains(e.relatedTarget as Node)) {
        setHasFocus(false);
      }
    },
    [onChange]
  );

  return (
    <div>
      {label && <div className={disabled ? 'opacity-50' : ''}>{label}</div>}
      <div ref={parentRef}>
        <div className={cn('flex w-full items-center space-x-2', error ? 'border border-red-500' : '')}>
          <Input
            className={className}
            ref={ref}
            defaultValue={value}
            onBlur={handleOnBlur}
            onFocus={() => setHasFocus(true)}
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
                setTimeout(onEnter, 0);
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          />
        </div>
        {footer && <div className="text-xs">{footer}</div>}
        {error && <div className="text-xs text-red-500">{error}</div>}
        {hasFocus && showOnFocus}
      </div>
    </div>
  );
});

export const ValidationTextArea = (props: InputProps) => {
  const { label, value, onChange, onInput, footer, height, placeholder, disabled, readOnly, onEnter } = props;
  const ref = useRef<HTMLTextAreaElement>(null);

  const onBlur = useCallback(
    (e: FocusEvent<HTMLTextAreaElement>) => {
      if (onChange) {
        onChange(e.currentTarget.value);
      }
    },
    [onChange]
  );

  useEffect(() => {
    if (ref.current) {
      ref.current.value = value ?? '';
    }
  }, [value]);

  return (
    <div>
      {label && <div className={disabled ? 'opacity-50' : ''}>{label}</div>}
      <div>
        <Textarea
          ref={ref}
          onBlur={onChange ? onBlur : undefined}
          onInput={onInput ? (e) => onInput(e.currentTarget.value) : undefined}
          style={{ height }}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && onEnter) {
              // need to ensure the value is set when pressing enter
              if (value !== e.currentTarget.value) {
                onInput?.(e.currentTarget.value);
                onChange?.(e.currentTarget.value);
              }
              setTimeout(onEnter, 0);
            }
          }}
        />
        {footer && <div className="text-xs">{footer}</div>}
      </div>
    </div>
  );
};

export const ValidationMoreOptions = (props: { validationData: ValidationData }) => {
  const { moreOptions, toggleMoreOptions } = props.validationData;

  return <Button onClick={toggleMoreOptions}>{moreOptions ? 'Hide' : 'Show'} Messages</Button>;
};

interface DropdownProps {
  label?: string;
  value: string;
  className?: string;
  onChange: (value: string) => void;
  options: (string | { value: string; label: string | JSX.Element })[];
  disabled?: boolean;
  readOnly?: boolean;

  // first entry is blank
  includeBlank?: boolean;
}

export const ValidationDropdown = (props: DropdownProps) => {
  const { label, value, className, onChange, options, disabled, readOnly, includeBlank } = props;

  const optionsBlank = includeBlank ? [{ value: 'blank', label: '' }, ...options] : options;

  return (
    <div className={className}>
      {label && <div className={disabled ? 'opacity-50' : ''}>{label}</div>}
      <Select value={value} onValueChange={onChange} disabled={disabled || readOnly}>
        <SelectTrigger
          className="select-none"
          onClick={(e) => {
            // this is needed to avoid selecting text when clicking the dropdown
            e.preventDefault();
          }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {optionsBlank.map((option) => (
            <SelectItem
              className="h-7"
              key={typeof option === 'string' ? option : option.value}
              value={typeof option === 'string' ? option : option.value}
            >
              {typeof option === 'string' ? option : option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

interface CloseProps {
  onClose: () => void;
}

export const ValidationClose = (props: CloseProps) => {
  const { onClose } = props;
  return (
    <IconButton sx={{ padding: 0, width: 20, height: 20 }} onClick={onClose}>
      <Close sx={{ padding: 0, width: 15, height: 15 }} />
    </IconButton>
  );
};
