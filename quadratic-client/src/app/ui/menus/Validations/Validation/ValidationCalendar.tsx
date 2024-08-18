import { Calendar } from '@/shared/shadcn/ui/calendar';

interface Props {
  dates?: Date[];
  setDates: (dates: Date[]) => void;
}

export const ValidationCalendar = (props: Props) => {
  const { dates, setDates } = props;

  const handleOnSelect = (dates?: Date[]) => {
    setDates(dates ?? []);
  };

  return (
    <div className="w-fit border bg-white shadow">
      <Calendar mode="multiple" selected={dates} onSelect={handleOnSelect} />
    </div>
  );
};
