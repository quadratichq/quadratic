import { Button } from '@/shared/shadcn/ui/button';
import { Checkbox } from '@/shared/shadcn/ui/checkbox';
import { Input } from '@/shared/shadcn/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { TextArea } from '@/shared/shadcn/ui/textarea';
import { cn } from '@/shared/shadcn/utils';
import { FocusEvent, useCallback, useEffect, useRef } from 'react';
import { ValidationData } from './useValidationData';

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
  label?: string;
  value: string;
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
}

export const ValidationInput = (props: InputProps) => {
  const { label, value, onChange, onInput, footer, height, placeholder, error, disabled, readOnly, type, onEnter } =
    props;
  const ref = useRef<HTMLInputElement>(null);

  const onBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(e.currentTarget.value);
      }
    },
    [onChange]
  );

  useEffect(() => {
    if (ref.current) {
      ref.current.value = value;
    }
  }, [value]);

  return (
    <div>
      {label && <div className={disabled ? 'opacity-50' : ''}>{label}</div>}
      <div>
        <div className={cn('flex w-full items-center space-x-2', error ? 'border border-red-500' : '')}>
          <Input
            ref={ref}
            onBlur={onBlur}
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
              }
            }}
          />
        </div>
        {footer && <div className="text-xs">{footer}</div>}
        {error && <div className="text-xs text-red-500">{error}</div>}
      </div>
    </div>
  );
};

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
      ref.current.value = value;
    }
  }, [value]);

  return (
    <div>
      {label && <div className={disabled ? 'opacity-50' : ''}>{label}</div>}
      <div>
        <TextArea
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
  onChange: (value: string) => void;
  options: { value: string; label: string | JSX.Element }[];
  disabled?: boolean;
  readOnly?: boolean;
}

export const ValidationDropdown = (props: DropdownProps) => {
  const { label, value, onChange, options, disabled, readOnly } = props;

  return (
    <div>
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
          {options.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
