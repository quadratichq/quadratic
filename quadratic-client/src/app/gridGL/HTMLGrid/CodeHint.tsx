import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { fileHasData } from '@/app/gridGL/helpers/fileHasData';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { useEffect, useState } from 'react';
import { isMobile } from 'react-device-detect';

export const CodeHint = () => {
  const {
    userMakingRequest: { filePermissions },
  } = useFileRouteLoaderData();
  const canEdit = filePermissions.includes('FILE_EDIT');
  const [open, setOpen] = useState(!fileHasData());

  // Show/hide depending on whether the file has any data in it
  useEffect(() => {
    const checkBounds = () => {
      setOpen(!fileHasData());
    };

    events.on('hashContentChanged', checkBounds);
    return () => {
      events.off('hashContentChanged', checkBounds);
    };
  }, [open]);

  if (!canEdit) {
    return null;
  }

  if (!open) {
    return null;
  }

  if (isMobile) {
    return null;
  }

  const offset = sheets.sheet.getCellOffsets(1, 1);
  return (
    <div
      className="center pointer-events-none absolute ml-1 whitespace-nowrap pr-0.5 text-xs leading-3 text-muted-foreground"
      style={{
        left: offset.x + CURSOR_THICKNESS,
        top: offset.y + CURSOR_THICKNESS * 2,
      }}
    >
      Press / to code
    </div>
  );
};
