import { sheets } from '@/app/grid/controller/Sheets';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Label } from '@/shared/shadcn/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/shadcn/ui/radio-group';
import { cn } from '@/shared/shadcn/utils';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Tooltip } from '@mui/material';
import { CheckIcon } from '@radix-ui/react-icons';
import { useEffect, useRef, useState } from 'react';
import { ValidationInput } from '../../../Validations/Validation/ValidationUI';

// first format is default rendering
const DATE_FORMATS = [
  { value: '%m/%d/%Y', label: '3/4/2024' },
  { value: '%Y-%m-%d', label: '2024-3-4' },
  { value: '%B %d, %Y', label: 'March 4, 2024' },
];

// first format is default rendering
const TIME_FORMATS = [
  { value: '%I:%M %p', label: '3:14 PM' },
  { value: '%I:%M:%S %p', label: '3:14:01 PM' },
  { value: '%H:%M', label: '15:14' },
  { value: '%H:%M:%S', label: '15:14:01' },
];

interface RadioEntryProps {
  value: string;
  label: string;
}

const RadioEntry = (props: RadioEntryProps) => {
  const { value, label } = props;

  return (
    <div className="flex items-center space-x-2">
      <RadioGroupItem value={value} id={value} className="border-0" />
      <Label htmlFor={value}>{label}</Label>
    </div>
  );
};

// todo: add link to help page...

const customHelp = (
  <div className="h-full cursor-pointer" onClick={() => console.log('open help for date time formats')}>
    <Tooltip title="Help with custom date and time formats" className="align-super">
      <HelpOutlineIcon sx={{ width: '0.85rem', height: '0.85rem' }} />
    </Tooltip>
  </div>
);

interface DateFormatProps {
  status: boolean;
  closeMenu: () => void;
}

export const DateFormat = (props: DateFormatProps) => {
  const { status, closeMenu } = props;
  const ref = useRef<HTMLInputElement>(null);

  const [time, setTime] = useState<string | undefined>(TIME_FORMATS[0].value);
  const [date, setDate] = useState<string | undefined>(DATE_FORMATS[0].value);
  const [custom, setCustom] = useState<string | undefined>();

  useEffect(() => {
    const findCurrent = async () => {
      const cursorPosition = sheets.sheet.cursor.cursorPosition;
      const summary = await quadraticCore.getCellFormatSummary(
        sheets.sheet.id,
        cursorPosition.x,
        cursorPosition.y,
        true
      );
      let updatedDate = DATE_FORMATS[0].value;
      let updatedTime = TIME_FORMATS[0].value;

      if (summary?.dateTime) {
        for (const format of DATE_FORMATS) {
          if (summary.dateTime.includes(format.value)) {
            updatedDate = format.value;
            break;
          }
        }
        for (const format of TIME_FORMATS) {
          if (summary.dateTime.includes(format.value)) {
            updatedTime = format.value;
            break;
          }
        }
        if (summary.dateTime.replace(updatedDate, '').replace(updatedTime, '').trim() === '') {
          setTime(updatedTime);
          setDate(updatedDate);
          setCustom(undefined);
        } else {
          setCustom(summary.dateTime);
          setDate(undefined);
          setTime(undefined);
        }
      } else {
        setDate(updatedDate);
        setTime(updatedTime);
        setCustom(undefined);
      }
    };

    if (status) {
      findCurrent();
    }
  }, [status]);

  const changeDate = (value: string) => {
    setDate(value);
    const currentTime = time ?? TIME_FORMATS[0].value;
    const newTime = `${value} ${currentTime}`;
    setCustom(undefined);
    quadraticCore.setDateTimeFormat(sheets.getRustSelection(), newTime, sheets.getCursorPosition());
  };

  const changeTime = (value: string) => {
    setTime(value);
    const currentDate = date ?? DATE_FORMATS[0].value;
    const newTime = `${currentDate} ${value}`;
    setCustom(undefined);
    quadraticCore.setDateTimeFormat(sheets.getRustSelection(), newTime, sheets.getCursorPosition());
  };

  const changeCustom = async (value: string) => {
    setTime(undefined);
    setDate(undefined);
    setCustom(value);
    quadraticCore.setDateTimeFormat(sheets.getRustSelection(), value, sheets.getCursorPosition());
  };

  const customFocus = () => {
    ref.current?.focus();
  };

  return (
    <div className="flex flex-col gap-5 px-8 py-4">
      <div>
        <RadioGroup value={date} onValueChange={changeDate}>
          <div className="flex flex-col gap-1">Date Format</div>
          {DATE_FORMATS.map((format) => (
            <RadioEntry key={format.value} value={format.value} label={format.label} />
          ))}
        </RadioGroup>
      </div>
      <div>
        <RadioGroup value={time} onValueChange={changeTime}>
          <div>Time Format</div>
          {TIME_FORMATS.map((format) => (
            <RadioEntry key={format.value} value={format.value} label={format.label} />
          ))}
        </RadioGroup>
      </div>
      <div>
        <div className="mb-1">Custom Time and Date Format</div>
        <div className="flex items-center">
          <div
            className="mr-2 aspect-square h-4 w-4 cursor-pointer rounded-full border shadow focus-visible:ring-1 focus-visible:ring-ring"
            onClick={customFocus}
          >
            <CheckIcon className={(cn('h-3.5 w-3.5 fill-primary'), custom ? '' : 'invisible')} />
          </div>
          <ValidationInput
            ref={ref}
            className="h-6"
            placeholder="Custom"
            onChange={changeCustom}
            value={custom ?? ''}
            onEnter={closeMenu}
          />
          {customHelp}
        </div>
      </div>
    </div>
  );
};
