import { Checkbox } from '@/shared/shadcn/ui/checkbox';
import { ValidationData } from './useValidationData';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';

interface CheckboxProps {
  label: string;
  showDropdown: boolean;
  changeDropDown: (checked: boolean) => void;
}

export const ValidationCheckbox = (props: CheckboxProps) => {
  const { label, showDropdown, changeDropDown } = props;

  return (
    <div className="flex items-center space-x-2">
      <Checkbox id={label} checked={showDropdown} onCheckedChange={changeDropDown} />
      <label htmlFor="show-dropdown" className="text-sm font-medium">
        {label}
      </label>
    </div>
  );
};

interface SingleInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  footer?: string | JSX.Element;
  height?: string;
}

export const ValidationInput = (props: SingleInputProps) => {
  const { label, value, onChange, footer, height } = props;

  return (
    <div>
      <label htmlFor={label}>{label}</label>
      <div>
        <Input
          id="validation-list-input"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          style={{ height }}
        />
        {footer && <div className="text-xs">{footer}</div>}
      </div>
    </div>
  );
};

export const ValidationMoreOptions = (props: { validationData: ValidationData }) => {
  const { moreOptions, toggleMoreOptions } = props.validationData;

  return <Button onClick={toggleMoreOptions}>{moreOptions ? 'Hide' : 'Show'} Options</Button>;
};

interface DropdownProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string | JSX.Element }[];
}

export const ValidationDropdown = (props: DropdownProps) => {
  const { label, value, onChange, options } = props;

  return (
    <div>
      {label && <div>{label}</div>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="None" className="select-none" />
        </SelectTrigger>
        <SelectContent>
          {options.map(({ value, label }) => (
            <SelectItem key={value} value={value} className="select-none">
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
