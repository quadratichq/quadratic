import { sheets } from '@/app/grid/controller/Sheets';
import { applyFormatToDateTime } from '@/app/quadratic-core/quadratic_core';
import { ValidationInput } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationInput';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { DOCUMENTATION_DATE_TIME_FORMATTING } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { Label } from '@/shared/shadcn/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/shadcn/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { cn } from '@/shared/shadcn/utils';
import { useCallback, useEffect, useRef, useState } from 'react';

// first format is default rendering
const DATE_FORMATS = [
  { value: '%m/%d/%Y', label: '03/04/2024' },
  { value: '%Y-%m-%d', label: '2024-03-04' },
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

const defaultDate = `03/04/${new Date().getFullYear()} 3:14 PM`;

interface DateFormatProps {
  closeMenu: () => void;
  className?: string;
}

export const DateFormat = (props: DateFormatProps) => {
  const { closeMenu, className } = props;
  const ref = useRef<HTMLInputElement>(null);

  const [time, setTime] = useState<string | undefined>(TIME_FORMATS[0].value);
  const [date, setDate] = useState<string | undefined>(DATE_FORMATS[0].value);
  const [custom, setCustom] = useState<string | undefined>();
  const [tab, setTab] = useState<'presets' | 'custom'>('presets');

  const [original, setOriginal] = useState<string | undefined>(defaultDate);
  const [current, setCurrent] = useState<string | undefined>();
  const findCurrent = useCallback(async () => {
    const cursorPosition = sheets.sheet.cursor.position;
    const editCell = await quadraticCore.getEditCell(sheets.current, cursorPosition.x, cursorPosition.y);
    if (editCell?.text) {
      setOriginal(editCell.text);
    } else {
      setOriginal(defaultDate);
    }
    const summary = await quadraticCore.getCellFormatSummary(sheets.current, cursorPosition.x, cursorPosition.y);
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
  }, []);

  useEffect(() => {
    findCurrent();
  }, [findCurrent]);

  const [formattedDate, setFormattedDate] = useState<string | undefined>();
  useEffect(() => {
    if (original && current) {
      setFormattedDate(applyFormatToDateTime(original, current));
    }
  }, [original, current]);

  const apply = useCallback(() => {
    const format = !date && !time && custom ? custom : `${date} ${time}`;
    quadraticCore.setDateTimeFormat(sheets.getRustSelection(), format, false);
    closeMenu();
  }, [closeMenu, custom, date, time]);

  const changeDate = useCallback(
    (value: string) => {
      setDate(value);
      const currentTime = time ?? TIME_FORMATS[0].value;
      setCurrent(`${value} ${currentTime}`);
      setCustom(`${value} ${currentTime}`);
    },
    [time]
  );

  const changeTime = useCallback(
    (value: string) => {
      setTime(value);
      const currentDate = date ?? DATE_FORMATS[0].value;
      setCurrent(`${currentDate} ${value}`);
      setCustom(`${currentDate} ${value}`);
    },
    [date]
  );

  const changeCustom = useCallback(async (value: string) => {
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
  }, []);

  const customFocus = useCallback(() => {
    ref.current?.focus();
  }, []);

  if (!current) return null;

  return (
    <div className={cn('h-58 w-full', className)}>
      {formattedDate && <div className="flex items-center justify-center bg-accent p-2 text-sm">{formattedDate}</div>}
      <Tabs className="text-sm" value={tab}>
        <TabsList className="mt-1 w-full border-b border-border">
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
              onInput={changeCustom}
              value={custom ?? ''}
              onEnter={(value) => {
                changeCustom(value);
                apply();
                closeMenu();
              }}
              onKeyDown={(e) => {
                // ensures that the menu does not close when the user presses keys like arrow
                e.stopPropagation();
              }}
            />
            <p className="text-xs text-muted-foreground">
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
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="secondary" onClick={closeMenu}>
          Cancel
        </Button>
        <Button onClick={apply}>Apply</Button>
      </div>
    </div>
  );
};
