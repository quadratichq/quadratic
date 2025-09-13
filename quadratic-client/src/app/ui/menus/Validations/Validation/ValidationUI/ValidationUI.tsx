import type { ValidationData } from '@/app/ui/menus/Validations/Validation/useValidationData';
import { Button } from '@/shared/shadcn/ui/button';
import { Checkbox } from '@/shared/shadcn/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { Close } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import type { FocusEvent, JSX } from 'react';
import { forwardRef, useCallback, useEffect, useRef } from 'react';

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

interface TextAreaProps {
  className?: string;

  label?: string;
  value?: string;
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
}

export const ValidationTextArea = (props: TextAreaProps) => {
  const { className, label, value, onChange, onInput, footer, height, placeholder, disabled, readOnly, onEnter } =
    props;
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
          className={className}
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

export type DropdownOption = (string | { value: string; label: string | JSX.Element })[];

interface DropdownProps {
  label?: string;
  labelClassName?: string;
  value: string;
  className?: string;
  onChange: (value: string) => void;
  options: DropdownOption;
  disabled?: boolean;
  readOnly?: boolean;
  style?: React.CSSProperties;

  // first entry is blank
  includeBlank?: boolean;
  tabIndex?: number;
}

export const ValidationDropdown = forwardRef((props: DropdownProps, ref: React.Ref<HTMLDivElement>) => {
  const {
    label,
    labelClassName,
    value,
    className,
    onChange,
    options,
    disabled,
    readOnly,
    includeBlank,
    style,
    tabIndex,
  } = props;

  const optionsBlank = includeBlank ? [{ value: 'blank', label: '' }, ...options] : options;

  return (
    <div ref={ref} className={className} style={style}>
      {label && <div className={`${labelClassName ?? ''} ${disabled ? 'opacity-50' : ''}`}>{label}</div>}
      <Select value={value} onValueChange={onChange} disabled={disabled || readOnly}>
        <SelectTrigger
          className="select-none"
          onClick={(e) => {
            // this is needed to avoid selecting text when clicking the dropdown
            e.preventDefault();
          }}
          tabIndex={tabIndex}
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
});

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
