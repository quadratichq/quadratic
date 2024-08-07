import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/app/gridGL/types/size';
import { isCsv, isExcel, isParquet } from '@/app/helpers/files';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { DragEvent, PropsWithChildren, useRef, useState } from 'react';

export type DragAndDropFileType = 'csv' | 'excel' | 'parquet';

const isDraggedFileExcel = (e: DragEvent<HTMLDivElement>) => {
  const excelTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  const fileMimeTypes = e.dataTransfer.items[0].type;
  return excelTypes.includes(fileMimeTypes);
};

const getFileType = (file: File): DragAndDropFileType => {
  if (isCsv(file)) return 'csv';
  if (isExcel(file)) return 'excel';
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
    const cursor = sheets.sheet.cursor;
    const { column, row } = sheets.sheet.getColumnRowFromScreen(world.x, world.y);
    const hasMoved =
      cursor.cursorPosition.x !== column ||
      cursor.cursorPosition.y !== row ||
      cursor.keyboardMovePosition.x !== column ||
      cursor.keyboardMovePosition.y !== row;
    if (hasMoved) {
      cursor.changePosition({
        cursorPosition: { x: column, y: row },
        keyboardMovePosition: { x: column, y: row },
      });
    }
  };

  // handle drag events
  const handleDrag = function (e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
      if (isDraggedFileExcel(e)) {
        // show overlay for excel files
      } else {
        moveCursor(e);
      }
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
        const { column, row } = sheets.sheet.getColumnRowFromScreen(world.x, world.y);
        const insertAtCellLocation = { x: column, y: row } as Coordinate;

        if (fileType === 'csv') {
          const error = await quadraticCore.importCsv(sheets.sheet.id, file, insertAtCellLocation);
          if (error) {
            addGlobalSnackbar(`Error loading ${file.name}: ${error}`, { severity: 'warning' });
          }
        } else if (fileType === 'excel') {
          for (const file of e.dataTransfer.files) {
            const fileType = getFileType(file);
            if (fileType !== 'excel') continue;

            const contents = await file.arrayBuffer().catch(console.error);
            if (!contents) return;

            const buffer = new Uint8Array(contents);
            const { error } = await quadraticCore.importExcel(buffer, file.name, sheets.getCursorPosition());
            if (error) {
              addGlobalSnackbar(`Error loading ${file.name}: ${error}`, { severity: 'warning' });
            }
          }
        } else if (fileType === 'parquet') {
          const error = await quadraticCore.importParquet(sheets.sheet.id, file, insertAtCellLocation);
          if (error) {
            addGlobalSnackbar(`Error loading ${file.name}: ${error}`, { severity: 'warning' });
          }
        } else {
          addGlobalSnackbar('Unsupported file type', { severity: 'warning' });
        }
      } catch (e) {
        if (e instanceof Error) addGlobalSnackbar(e.message, { severity: 'warning' });
      }
    }
  };

  return (
    <div
      ref={divRef}
      onDragEnter={handleDrag}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        position: 'relative',
        minWidth: 0,
      }}
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
