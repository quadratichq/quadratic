import { sheets } from '@/app/grid/controller/Sheets';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/shadcn/ui/radio-group';
import { cn } from '@/shared/shadcn/utils';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { CheckIcon } from '@radix-ui/react-icons';
import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  label: string;
}

const RadioEntry = (props: Props) => {
  const { value, label } = props;

  return (
    <div className="flex items-center space-x-2">
      <RadioGroupItem value={value} id={value} className="border-0" />
      <Label htmlFor={value}>{label}</Label>
    </div>
  );
};

interface CustomProps {
  value: string;
}

const Custom = (props: CustomProps) => {
  const { value } = props;
  return (
    <div className="flex items-center">
      <RadioGroupItem value={value} className="mr-2 border-0" />
      <Input className="h-6" placeholder="Custom" />
      <HelpOutlineIcon fontSize="small" />
    </div>
  );
};

export const DateFormat = () => {
  const ref = useRef<HTMLInputElement>(null);

  const [time, setTime] = useState<string | undefined>();
  const [date, setDate] = useState<string | undefined>();
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
      console.log(summary);
      setDate('a');
      setTime('a');
      setCustom(undefined);
    };
    findCurrent();
  }, []);

  const changeDate = (value: string) => {};

  const changeTime = (value: string) => {};

  const changeCustom = (value: string) => {
    setCustom(value);
    setDate(undefined);
    setTime(undefined);
  };

  const customFocus = () => {
    ref.current?.focus();
  };

  return (
    <div className="flex flex-col gap-5 px-8 py-4">
      <div>
        <RadioGroup defaultValue={date} onValueChange={changeDate}>
          <div className="flex flex-col gap-1">Date Format</div>
          <RadioEntry value="a" label="3/4/2024" />
          <RadioEntry value="b" label="2024-3-4" />
          <RadioEntry value="c" label="March 4, 2024" />
          <Custom value="custom-date" />
        </RadioGroup>
      </div>
      <div>
        <RadioGroup defaultValue={time} onValueChange={changeTime}>
          <div>Time Format</div>
          <RadioEntry value="a" label="3:14 PM" />
          <RadioEntry value="b" label="3:14 pm" />
          <RadioEntry value="c" label="3:14:01 pm" />
          <RadioEntry value="d" label="3:14:01 PM" />
          <RadioEntry value="e" label="15:14" />
          <Custom value="custom-time" />
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
          <Input ref={ref} className="h-6" placeholder="Custom" onChange={(e) => changeCustom(e.currentTarget.value)} />
          <HelpOutlineIcon fontSize="small" />
        </div>
      </div>
    </div>
  );
};
