import { Calendar } from '@/shared/shadcn/ui/calendar';
import { useCallback } from 'react';

interface Props {
  dates?: Date[];

  // allow multiple dates
  multiple?: boolean;

  // returns an array of strings in the format of 'YYYY-MM-DD'
  setDates: (dates: string) => undefined;

  // use this month to open calendar if props.dates is not set
  fallbackMonth?: Date;
}

// converts a Date object to a string in the format of 'YYYY-MM-DD'
const dateTimeToDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ValidationCalendar = (props: Props) => {
  const { dates, multiple, setDates, fallbackMonth } = props;

  const ref = useCallback((node: HTMLDivElement) => {
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  const handleOnSelectSingle = (date?: Date) => {
    const newDate = date ? dateTimeToDateString(date) : '';
    setDates(newDate);
  };

  const handleOnSelectMultiple = (dates?: Date[]) => {
    const newDates = dates ? dates.map((d) => dateTimeToDateString(d)).join(', ') : '';
    setDates(newDates);
  };

  const defaultMonth = dates?.length ? dates[dates.length - 1] : fallbackMonth;

  return (
    <div ref={ref} className="w-fit border bg-white shadow">
      {!multiple && (
        <Calendar
          mode="single"
          selected={dates?.[0]}
          onSelect={handleOnSelectSingle}
          defaultMonth={dates?.[0] ?? defaultMonth}
        />
      )}
      {multiple && (
        <Calendar mode="multiple" selected={dates} onSelect={handleOnSelectMultiple} defaultMonth={defaultMonth} />
      )}
    </div>
  );
};
