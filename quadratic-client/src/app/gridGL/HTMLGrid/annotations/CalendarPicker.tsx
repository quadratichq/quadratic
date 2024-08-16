import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { Calendar } from '../../../../shared/shadcn/ui/calendar';
import { useRecoilValue } from 'recoil';
import { useEffect, useState } from 'react';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorEvents } from '../inlineEditor/inlineEditorEvents';
import { formatDate, formatTime } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { inlineEditorHandler } from '../inlineEditor/inlineEditorHandler';
import { events } from '@/app/events/events';
import { ValidationInput } from '@/app/ui/menus/Validations/Validation/ValidationUI';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { Button } from '@/shared/shadcn/ui/button';

export const CalendarPicker = () => {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);

  const showTime = editorInteractionState.annotationState === 'calendar-time';
  const showCalendar =
    editorInteractionState.annotationState === 'calendar' || editorInteractionState.annotationState === 'calendar-time';

  const [value, setValue] = useState<string | undefined>();
  const [date, setDate] = useState<Date | undefined>();
  const [dateFormat, setDateFormat] = useState<string | undefined>('');
  useEffect(() => {
    const fetchValue = async () => {
      const position = sheets.sheet.cursor.cursorPosition;
      const value = await quadraticCore.getDisplayCell(sheets.sheet.id, position.x, position.y);
      if (value) {
        const d = new Date(value as string);
        // this tests if the Date is valid
        if (isNaN(d as any)) {
          setDate(undefined);
        } else {
          setDate(d);
        }
        setValue(value);
      }
      const summary = await quadraticCore.getCellFormatSummary(sheets.sheet.id, position.x, position.y, true);
      if (summary.dateTime) {
        setDateFormat(summary.dateTime);
      } else {
        setDateFormat(undefined);
      }
    };

    if (showCalendar) fetchValue();
  }, [editorInteractionState.annotationState, showCalendar, showTime]);

  // we need to clear the component when the cursor moves to ensure it properly
  // populates when changing position.
  useEffect(() => {
    const clear = () => {
      setDate(undefined);
      setDateFormat(undefined);
      setValue(undefined);
    };

    events.on('cursorPosition', clear);
    return () => {
      events.off('cursorPosition', clear);
    };
  });

  const dateToDateTimeString = (date: Date): string => {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  };

  const changeDate = (date: Date | undefined) => {
    if (!date) return;
    const formattedDate = formatDate(dateToDateTimeString(date), dateFormat);
    setDate(date);
    inlineEditorEvents.emit('replaceText', formattedDate, false);
    if (!showTime) {
      inlineEditorHandler.close(0, 0, false);
    }
  };

  if (!showCalendar || !date || !value) return null;

  console.log(formatTime(value, dateFormat));
  return (
    <div className="pointer-events-auto border bg-white shadow">
      <Calendar mode="single" selected={date} defaultMonth={date} onSelect={changeDate} />
      {showTime && (
        <div className="flex w-full gap-2 p-3">
          <ValidationInput value={formatTime(value, dateFormat)} />
          <Button className="p-1">
            <AccessTimeIcon />
          </Button>
        </div>
      )}
    </div>
  );
};
