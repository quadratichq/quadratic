import { hasPermissionToEditFile } from '@/app/actions';
import { userMessageAtom } from '@/app/atoms/userMessageAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { Coordinate } from '@/app/gridGL/types/size';
import { DragAndDropFileType, isCsv, isExcel, isExcelMimeType, isParquet } from '@/app/helpers/files';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { DragEvent, PropsWithChildren, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';

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
  const setUserMessageState = useSetRecoilState(userMessageAtom);

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

    if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;

    if (e.type === 'dragenter') {
      setDragActive(true);
    } else if (e.type === 'dragover') {
      const mimeType = e.dataTransfer.items[0].type;
      if (isExcelMimeType(mimeType)) {
        setUserMessageState({ message: 'Dropped Excel file(s) will be imported as new sheet(s) in this file.' });
      } else {
        setUserMessageState({ message: undefined });
        moveCursor(e);
      }
    } else if (e.type === 'dragleave') {
      setDragActive(false);
      setUserMessageState({ message: undefined });
    }
  };

  // triggers when file is dropped
  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;

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
          setUserMessageState({ message: undefined });
          for (const file of e.dataTransfer.files) {
            try {
              const fileType = getFileType(file);
              if (fileType !== 'excel') {
                throw new Error('Cannot load multiple file types');
              }

              const contents = await file.arrayBuffer().catch(console.error);
              if (!contents) {
                throw new Error('Failed to read file');
              }

              const buffer = new Uint8Array(contents);
              const { error } = await quadraticCore.importExcel(buffer, file.name, sheets.getCursorPosition());
              if (error) {
                throw new Error(error);
              }
            } catch (error) {
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
