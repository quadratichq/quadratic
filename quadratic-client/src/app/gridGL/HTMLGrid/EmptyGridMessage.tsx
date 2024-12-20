import {
  editorInteractionStateShowCellTypeMenuAtom,
  editorInteractionStateShowConnectionsMenuAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { supportedFileTypes } from '@/app/helpers/files';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { useFileImport } from '@/app/ui/hooks/useFileImport';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Button } from '@/shared/shadcn/ui/button';
import { useEffect, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';

const fileHasData = () => sheets.sheets.filter((sheet) => sheet.bounds.type === 'nonEmpty').length > 0;

// When a file loads, if it's totally empty, show this message. Then once the
// user has edited the file, we'll hide it permanently.
export function EmptyGridMessage() {
  const {
    userMakingRequest: { filePermissions },
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();
  const canEdit = filePermissions.includes('FILE_EDIT');
  const [open, setOpen] = useState(false);
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
        Bring in your own data via a file (CSV, Excel, Parquet) or a connection (Postgres, MySQL, and more).
      </p>
      <div className="mt-2 flex w-full flex-col justify-center gap-2">
        <UploadFileButton teamUuid={teamUuid} />

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

function UploadFileButton({ teamUuid }: { teamUuid: string }) {
  const handleFileImport = useFileImport();
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button className="w-full" onClick={() => fileInputRef.current?.click()}>
        Upload file
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept={supportedFileTypes.join(',')}
        onChange={(e) => {
          const files = e.target.files;
          if (files) {
            handleFileImport({
              files,
              sheetId: sheets.sheet.id,
              insertAt: { x: 1, y: 1 },
              cursor: sheets.getCursorPosition(),
              teamUuid,
            });
          }
        }}
      />
    </>
  );
}
