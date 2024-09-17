import { ValidationCalendar } from '@/app/ui/menus/Validations/Validation/ValidationCalendar';
import { ValidationInput } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationInput';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { useMemo, useState } from 'react';

interface ValidationInputProps {
  // allow multiple dates separated by commas
  multiple?: boolean;

  // same as ValidationInput.tsx
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

  // clears the input value when toggling to true
  clear?: boolean;
}

export const ValidationDateInput = (props: ValidationInputProps) => {
  const { placeholder, multiple, onChange, value, className } = props;
  const placeholderText = placeholder ? placeholder : multiple ? 'Enter dates separated by commas' : 'Enter date';

  const [showCalendar, setShowCalendar] = useState(false);

  const dates = useMemo(() => {
    if (multiple) {
      if (value?.trim()) {
        return value.split(',').map((d) => new Date(d));
      } else {
        return [];
      }
    } else {
      return value ? [new Date(value)] : [];
    }
  }, [multiple, value]);

  return (
    <div className="flex w-full flex-col">
      <div className="relative w-full">
        <ValidationInput {...props} placeholder={placeholderText} className={cn('pr-10', className)} />
        <Button
          variant="ghost"
          className="absolute right-0 px-2"
          style={{ top: 1 }}
          onClick={() => setShowCalendar((show) => !show)}
        >
          <CalendarMonthIcon />
        </Button>
      </div>
      {showCalendar && (
        <ValidationCalendar
          multiple={multiple}
          dates={dates}
          setDates={(dates) => {
            onChange?.(dates);

            // close the calendar if not multiple
            if (!multiple) {
              setShowCalendar(false);
            }
          }}
        />
      )}
    </div>
  );
};
