import debounce from 'lodash.debounce';
import { DragEvent, PropsWithChildren, useRef, useState } from 'react';
import { useGlobalSnackbar } from '../../components/GlobalSnackbar';
import { InsertCSV } from '../../grid/actions/insertData/insertCSV';
import { sheetController } from '../../grid/controller/SheetController';
import { pixiApp } from '../../gridGL/pixiApp/PixiApp';
import { Coordinate } from '../../gridGL/types/size';

export const FileUploadWrapper = (props: PropsWithChildren) => {
  // drag state
  const [dragActive, setDragActive] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const moveCursor = debounce((e: DragEvent<HTMLDivElement>): void => {
    const clientBoudingRect = divRef?.current?.getBoundingClientRect();
    const world = pixiApp.viewport.toWorld(
      e.pageX - (clientBoudingRect?.left || 0),
      e.pageY - (clientBoudingRect?.top || 0)
    );
    const { column, row } = sheetController.sheet.gridOffsets.getRowColumnFromWorld(world.x, world.y);
    sheetController.sheet.cursor.changePosition({
      cursorPosition: { x: column, y: row },
      keyboardMovePosition: { x: column, y: row },
      multiCursor: {
        originPosition: { x: column, y: row },
        terminalPosition: { x: column, y: row },
      },
    });
  }, 100);

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
      if (file.type === 'text/csv' || file.type === 'text/tab-separated-values') {
        const clientBoudingRect = divRef?.current?.getBoundingClientRect();
        const world = pixiApp.viewport.toWorld(
          e.pageX - (clientBoudingRect?.left || 0),
          e.pageY - (clientBoudingRect?.top || 0)
        );
        const { column, row } = sheetController.sheet.gridOffsets.getRowColumnFromWorld(world.x, world.y);

        InsertCSV({
          file: file,
          insertAtCellLocation: { x: column, y: row } as Coordinate,
          reportError: addGlobalSnackbar,
        });
      } else {
        addGlobalSnackbar('File type not supported. Please upload a CSV file.');
      }
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
