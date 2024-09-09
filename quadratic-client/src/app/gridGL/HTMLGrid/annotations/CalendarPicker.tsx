import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { formatDate, formatDateTime, formatTime, parseTime } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { ValidationInput } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationInput';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { CheckSharp, Close } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { Calendar } from '../../../../shared/shadcn/ui/calendar';
import { inlineEditorEvents } from '../inlineEditor/inlineEditorEvents';
import { inlineEditorHandler } from '../inlineEditor/inlineEditorHandler';
import { inlineEditorMonaco } from '../inlineEditor/inlineEditorMonaco';

export const CalendarPicker = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);

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

  useEffect(() => {
    const changeStatus = (opened: boolean) => {
      if (!opened) {
        setDate(undefined);
        setDateFormat(undefined);
        setValue(undefined);
      }
    };
    inlineEditorEvents.on('status', changeStatus);
    return () => {
      inlineEditorEvents.off('status', changeStatus);
    };
  });

  const dateToDateString = (date: Date): string => {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  };

  const dateToDateTimeString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const changeDate = (newDate: Date | undefined) => {
    if (!newDate || !date) return;
    let replacement: string;
    if (showTime) {
      newDate.setHours(date.getHours(), date.getMinutes(), date.getSeconds());
      replacement = formatDateTime(dateToDateTimeString(newDate), dateFormat);
    } else {
      replacement = formatDate(dateToDateString(newDate), dateFormat);
    }
    setDate(newDate);
    inlineEditorEvents.emit('replaceText', replacement, false);
    if (!showTime) {
      inlineEditorHandler.close(0, 0, false);
    }
  };

  const changeTime = (time: string) => {
    if (!date) return;
    const combinedDate = parseTime(dateToDateString(date), time);
    if (combinedDate) {
      const newDate = new Date(combinedDate);
      if (!isNaN(newDate as any)) {
        setDate(newDate);
        inlineEditorEvents.emit('replaceText', formatDateTime(dateToDateTimeString(newDate), dateFormat), false);
      }
    }
  };

  const setCurrentDateTime = () => {
    const newDate = new Date();
    const replacement = formatDateTime(dateToDateTimeString(newDate), dateFormat);
    setDate(newDate);
    inlineEditorEvents.emit('replaceText', replacement, false);
    inlineEditorHandler.close(0, 0, false);
  };

  const close = () => {
    setEditorInteractionState((state) => ({
      ...state,
      annotationState: undefined,
    }));
    inlineEditorMonaco.focus();
  };

  const finish = () => inlineEditorHandler.close(0, 0, false);

  if (!showCalendar || !date || !value) return null;

  return (
    <div className="pointer-events-auto border bg-white shadow">
      <div className="px-1 pb-0 pt-1 text-right">
        <IconButton sx={{ padding: 0, width: 20, height: 20 }} onClick={close}>
          <Close sx={{ padding: 0, width: 15, height: 15 }} />
        </IconButton>
      </div>
      <Calendar mode="single" selected={date} defaultMonth={date} onSelect={changeDate} />
      {showTime && (
        <div className="flex w-full gap-2 p-3">
          <ValidationInput value={formatTime(value)} onChange={changeTime} onEnter={finish} />
          <TooltipPopover label="Set current date and time">
            <Button onClick={setCurrentDateTime} className="px-2">
              <CheckSharp fontSize="small" />
            </Button>
          </TooltipPopover>
        </div>
      )}
    </div>
  );
};
