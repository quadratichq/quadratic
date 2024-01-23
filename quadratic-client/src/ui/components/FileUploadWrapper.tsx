import { DragEvent, PropsWithChildren, useRef, useState } from 'react';
import { useGlobalSnackbar } from '../../components/GlobalSnackbarProvider';
import { grid } from '../../grid/controller/Grid';
import { sheets } from '../../grid/controller/Sheets';
import { pixiApp } from '../../gridGL/pixiApp/PixiApp';

export const FileUploadWrapper = (props: PropsWithChildren) => {
  // drag state
  const [dragActive, setDragActive] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const moveCursor = (e: DragEvent<HTMLDivElement>): void => {
    const clientBoudingRect = divRef?.current?.getBoundingClientRect();
    const world = pixiApp.viewport.toWorld(
      e.pageX - (clientBoudingRect?.left || 0),
      e.pageY - (clientBoudingRect?.top || 0)
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

  const csvTypes = ["text/csv", "text/tab-separated-values"]
  const excelTypes = [
    "application/vnd.ms-excel",
    "application/excel",
    "application/x-excel",
    "application/x-msexcel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]

  // triggers when file is dropped
  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files.item(0);
    if (!file) {
      return
    }

    const clientBoudingRect = divRef?.current?.getBoundingClientRect();
    const world = pixiApp.viewport.toWorld(
      e.pageX - (clientBoudingRect?.left || 0),
      e.pageY - (clientBoudingRect?.top || 0)
    );
    const insertAtCellLocation = sheets.sheet.offsets.getColumnRowFromScreen(world.x, world.y);
    if (csvTypes.includes(file.type)) {
      grid.import("csv", sheets.sheet.id, file, insertAtCellLocation, addGlobalSnackbar);
    } else if (excelTypes.includes(file.type)) {
      grid.import("excel", sheets.sheet.id, file, insertAtCellLocation, addGlobalSnackbar);
    } else {
      const extension = file.name?.split('.')?.pop() ?? file.type;
      addGlobalSnackbar(`File type not supported (${extension}). Please upload a Excel or CSV file.`);
    }
  };

  return (
    <div ref={divRef} onDragEnter={handleDrag} style={{ flex: 1 }}>
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
