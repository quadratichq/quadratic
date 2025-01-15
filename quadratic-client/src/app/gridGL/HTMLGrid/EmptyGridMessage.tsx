import { Action } from '@/app/actions/actions';
import { insertActionsSpec } from '@/app/actions/insertActionsSpec';
import {
  editorInteractionStateShowCellTypeMenuAtom,
  editorInteractionStateShowConnectionsMenuAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Button } from '@/shared/shadcn/ui/button';
import { useEffect, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useSetRecoilState } from 'recoil';

const fileHasData = () => sheets.sheets.filter((sheet) => sheet.bounds.type === 'nonEmpty').length > 0;

// When a file loads, if it's totally empty, show this message. Then once the
// user has edited the file, we'll hide it permanently.
export function EmptyGridMessage() {
  const {
    userMakingRequest: { filePermissions },
  } = useFileRouteLoaderData();
  const canEdit = filePermissions.includes('FILE_EDIT');
  const [open, setOpen] = useState(fileHasData() ? false : true);
  const showConnectionsMenu = useSetRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const showCellTypeMenu = useSetRecoilState(editorInteractionStateShowCellTypeMenuAtom);
  const { data } = useConnectionsFetcher();
  const connections = data?.connections ?? [];

  // Show/hide depending on whether the file has any data in it
  useEffect(() => {
    const checkBounds = () => {
      setOpen(fileHasData() ? false : true);
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

  return (
    <div className="absolute bottom-4 right-4 flex w-72 flex-col items-center rounded border border-border bg-background p-4 text-center shadow-md">
      <div className="flex gap-4 pb-8 pt-10">
        <div className="flex flex-col items-start gap-2">
          <div className="h-2 w-12 bg-foreground/15" />
          <div className="h-1 w-9 bg-foreground/15" />
          <div className="h-1 w-11 bg-foreground/15" />
          <div className="h-1 w-7 bg-foreground/15" />
          <div className="h-1 w-8 bg-foreground/15" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-2 w-12 bg-foreground/15" />
          <div className="h-1 w-9 bg-foreground/15" />
          <div className="h-1 w-11 bg-foreground/15" />
          <div className="h-1 w-7 bg-foreground/15" />
          <div className="h-1 w-8 bg-foreground/15" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="h-2 w-12 bg-foreground/15" />
          <div className="h-1 w-9 bg-foreground/15" />
          <div className="h-1 w-11 bg-foreground/15" />
          <div className="h-1 w-7 bg-foreground/15" />
          <div className="h-1 w-8 bg-foreground/15" />
        </div>
      </div>
      <h2 className="text-md font-semibold">Import data</h2>
      <p className="text-sm text-muted-foreground">
        Drag and drop a file (CSV, Excel, Parquet) or use a connection (Postgres, MySQL, and more).
      </p>
      <div className="mt-2 flex w-full flex-col justify-center gap-2">
        <Button
          className="w-full"
          onClick={() => {
            insertActionsSpec[Action.InsertFile].run();
          }}
        >
          Upload file
        </Button>

        {connections.length === 0 ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              showConnectionsMenu(true);
            }}
          >
            Create connection
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              showCellTypeMenu(true);
            }}
          >
            Use connection
          </Button>
        )}
      </div>
    </div>
  );
}
