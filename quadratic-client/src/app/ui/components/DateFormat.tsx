import { sheets } from '@/app/grid/controller/Sheets';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { DOCUMENTATION_DATE_TIME_FORMATTING } from '@/shared/constants/urls';
import { Label } from '@/shared/shadcn/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/shadcn/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { useEffect, useRef, useState } from 'react';
import { ValidationInput } from '../menus/Validations/Validation/ValidationUI/ValidationInput';

// first format is default rendering
const DATE_FORMATS = [
  { value: '%m/%d/%Y', label: '3/4/2024' },
  { value: '%Y-%m-%d', label: '2024-3-4' },
  { value: '%B %d, %Y', label: 'March 4, 2024' },
];

// first format is default rendering
const TIME_FORMATS = [
  { value: '%-I:%M %p', label: '3:14 PM' },
  { value: '%-I:%M:%S %p', label: '3:14:01 PM' },
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
    <div className="flex items-center">
      <RadioGroupItem value={value} id={value} />
      <Label htmlFor={value} className="pl-2 font-normal">
        {label}
      </Label>
    </div>
  );
};

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
    <Tabs defaultValue={custom ? 'custom' : 'presets'} className="text-sm">
      <TabsList className="mt-2 w-full border-b border-border">
        <TabsTrigger
          value="presets"
          className="w-1/2"
          onClick={() => {
            setCustom(undefined);
            changeDate(date ?? DATE_FORMATS[0].value);
            changeTime(time ?? TIME_FORMATS[0].value);
          }}
        >
          Presets
        </TabsTrigger>
        <TabsTrigger
          value="custom"
          className="w-1/2"
          onClick={() => {
            setCustom('%d, %B %Y');
            customFocus();
          }}
        >
          Custom
        </TabsTrigger>
      </TabsList>
      <TabsContent value="presets" className="mt-2 grid grid-cols-2">
        <div>
          <RadioGroup value={date} onValueChange={changeDate}>
            <div className="font-semibold">Date</div>
            {DATE_FORMATS.map((format) => (
              <RadioEntry key={format.value} value={format.value} label={format.label} />
            ))}
          </RadioGroup>
        </div>
        <div>
          <RadioGroup value={time} onValueChange={changeTime}>
            <div className="font-semibold">Time</div>
            {TIME_FORMATS.map((format) => (
              <RadioEntry key={format.value} value={format.value} label={format.label} />
            ))}
          </RadioGroup>
        </div>
      </TabsContent>
      <TabsContent value="custom">
        <div className="flex flex-col gap-1">
          <ValidationInput
            ref={ref}
            placeholder="%d, %B %Y"
            onChange={changeCustom}
            value={custom ?? ''}
            onEnter={closeMenu}
          />
          <p className="text-xs text-muted-foreground ">
            Learn custom date and time formatting{' '}
            <a
              href={DOCUMENTATION_DATE_TIME_FORMATTING}
              target="_blank"
              className="underline hover:text-primary"
              title="Open help in another tab"
              rel="noreferrer"
            >
              in the docs
            </a>
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
};
