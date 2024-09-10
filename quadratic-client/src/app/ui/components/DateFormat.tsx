import { sheets } from '@/app/grid/controller/Sheets';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { DOCUMENTATION_DATE_TIME_FORMATTING } from '@/shared/constants/urls';
import { Label } from '@/shared/shadcn/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/shadcn/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ValidationInput } from '../menus/Validations/Validation/ValidationUI/ValidationInput';
import { Button } from '@/shared/shadcn/ui/button';
import { applyFormatToDateTime } from '@/app/quadratic-rust-client/quadratic_rust_client';

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

  const [tab, setTab] = useState<'presets' | 'custom'>('presets');

  const [original, setOriginal] = useState<string | undefined>('2024/3/4');
  const [current, setCurrent] = useState<string | undefined>();
  const [formattedDate, setFormattedDate] = useState<string | undefined>();
  useEffect(() => {
    if (original && current) {
      setFormattedDate(applyFormatToDateTime(original, current));
    }
  }, [original, current]);

  const apply = useCallback(() => {
    quadraticCore.setDateTimeFormat(sheets.getRustSelection(), `${date} ${time}`, sheets.getCursorPosition());
    closeMenu();
  }, [closeMenu, date, time]);

  useEffect(() => {
    const findCurrent = async () => {
      const cursorPosition = sheets.sheet.cursor.cursorPosition;
      const date = await quadraticCore.getEditCell(sheets.sheet.id, cursorPosition.x, cursorPosition.y);
      if (date) {
        setOriginal(date);
      }
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
          setCustom(`${updatedDate} ${updatedTime}`);
          setCurrent(`${updatedDate} ${updatedTime}`);
          setTab('presets');
        } else {
          setCustom(summary.dateTime);
          setDate(undefined);
          setTime(undefined);
          setCurrent(summary.dateTime);
          setTab('custom');
        }
      } else {
        setDate(updatedDate);
        setTime(updatedTime);
        setCustom(`${updatedDate} ${updatedTime}`);
        setCurrent(`${updatedDate} ${updatedTime}`);
        setTab('presets');
      }
    };

    if (status) {
      findCurrent();
    }
  }, [status]);

  const changeDate = (value: string) => {
    setDate(value);
    const currentTime = time ?? TIME_FORMATS[0].value;
    setCurrent(`${value} ${currentTime}`);
    setCustom(`${value} ${currentTime}`);
  };

  const changeTime = (value: string) => {
    setTime(value);
    const currentDate = date ?? DATE_FORMATS[0].value;
    setCurrent(`${currentDate} ${value}`);
    setCustom(`${currentDate} ${value}`);
  };

  const changeCustom = async (value: string) => {
    if (value) {
      // need to check if the value is a default format
      let possibleDate: string | undefined;
      let possibleTime: string | undefined;
      for (const format of DATE_FORMATS) {
        if (value.includes(format.value)) {
          possibleDate = format.value;
          break;
        }
      }
      for (const format of TIME_FORMATS) {
        if (value.includes(format.value)) {
          possibleTime = format.value;
          break;
        }
      }

      // the custom date is just `{date} {time}` so we can set it to defaults
      if (possibleDate && possibleTime && value.replace(possibleDate, '').replace(possibleTime, '').trim() === '') {
        setTime(possibleTime);
        setDate(possibleDate);
        setCustom(`${possibleDate} ${possibleTime}`);
      } else {
        setTime(undefined);
        setDate(undefined);
        setCustom(value);
      }
      setCurrent(value);
    }
  };

  const customFocus = () => {
    ref.current?.focus();
  };

  return (
    <div className="h-58">
      {formattedDate && (
        <div className="mt-3 flex items-center justify-center bg-gray-50 p-2 text-sm">{formattedDate}</div>
      )}
      <Tabs className="text-sm" value={tab}>
        <TabsList className="mt-2 w-full border-b border-border">
          <TabsTrigger value="presets" className="w-1/2" onClick={() => setTab('presets')}>
            Presets
          </TabsTrigger>
          <TabsTrigger
            value="custom"
            className="w-1/2"
            onClick={() => {
              setTab('custom');
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
      <div className="flex justify-end gap-2 pt-5">
        <Button onClick={apply}>Apply</Button>
        <Button variant="secondary" onClick={closeMenu}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
