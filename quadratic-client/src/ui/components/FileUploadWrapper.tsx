import { isCsv, isParquet } from '@/helpers/files';
import { DragEvent, PropsWithChildren, useRef, useState } from 'react';
import { useGlobalSnackbar } from '../../components/GlobalSnackbarProvider';
import { grid } from '../../grid/controller/Grid';
import { sheets } from '../../grid/controller/Sheets';
import { pixiApp } from '../../gridGL/pixiApp/PixiApp';
import { Coordinate } from '../../gridGL/types/size';

export type DragAndDropFileType = 'csv' | 'parquet';

const getFileType = (file: File): DragAndDropFileType => {
  if (isCsv(file)) return 'csv';
  if (isParquet(file)) return 'parquet';

  throw new Error(`Unsupported file type`);
};

export const FileUploadWrapper = (props: PropsWithChildren) => {
  // drag state
  const [dragActive, setDragActive] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const moveCursor = (e: DragEvent<HTMLDivElement>): void => {
    const clientBoundingRect = divRef?.current?.getBoundingClientRect();
    const world = pixiApp.viewport.toWorld(
      e.pageX - (clientBoundingRect?.left || 0),
      e.pageY - (clientBoundingRect?.top || 0)
    );
    const sheet = sheets.sheet;
    const offsets = sheet.offsets;
    const { column, row } = offsets.getColumnRowFromScreen(world.x, world.y);
    sheet.cursor.changePosition({
      cursorPosition: { x: column, y: row },
      keyboardMovePosition: { x: column, y: row },
      multiCursor: {
        originPosition: { x: column, y: row },
        terminalPosition: { x: column, y: row },
      },
    });
  };

  // handle drag events
  const handleDrag = function (e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);

      moveCursor(e);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // triggers when file is dropped
  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];

      try {
        const fileType = getFileType(file);
        const clientBoundingRect = divRef?.current?.getBoundingClientRect();
        const world = pixiApp.viewport.toWorld(
          e.pageX - (clientBoundingRect?.left || 0),
          e.pageY - (clientBoundingRect?.top || 0)
        );
        const { column, row } = sheets.sheet.offsets.getColumnRowFromScreen(world.x, world.y);
        const insertAtCellLocation = { x: column, y: row } as Coordinate;

        if (fileType === 'csv') grid.importCsv(sheets.sheet.id, file, insertAtCellLocation, addGlobalSnackbar);
        if (fileType === 'parquet') grid.importParquet(sheets.sheet.id, file, insertAtCellLocation, addGlobalSnackbar);
      } catch (e) {
        if (e instanceof Error) addGlobalSnackbar(e.message, { severity: 'warning' });
      }
    }
  };

  return (
    <div
      ref={divRef}
      onDragEnter={handleDrag}
      style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}
    >
      {props.children}
      {dragActive && (
        <div
          id="drag-file-element"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            top: '0px',
            right: '0px',
            bottom: '0px',
            left: '0px',
            opacity: '0',
          }}
        ></div>
      )}
    </div>
  );
};
