import debounce from 'lodash.debounce';
import { DragEvent, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { gridInteractionStateAtom } from '../../atoms/gridInteractionStateAtom';
import { InsertCSV } from '../../grid/actions/insertData/insertCSV';
import { SheetController } from '../../grid/controller/sheetController';
import { PixiApp } from '../../gridGL/pixiApp/PixiApp';
import { Coordinate } from '../../gridGL/types/size';
import { useGlobalSnackbar } from '../../shared/GlobalSnackbar';

interface Props {
  sheetController: SheetController;
  app: PixiApp;
}

export const FileUploadWrapper = (props: React.PropsWithChildren<Props>) => {
  const { app } = props;
  // drag state
  const [dragActive, setDragActive] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);
  const [interactionState, setInteractionState] = useRecoilState(gridInteractionStateAtom);
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const moveCursor = debounce((e: DragEvent<HTMLDivElement>): void => {
    const clientBoudingRect = divRef?.current?.getBoundingClientRect();
    const world = app.viewport.toWorld(
      e.pageX - (clientBoudingRect?.left || 0),
      e.pageY - (clientBoudingRect?.top || 0)
    );
    const { column, row } = props.sheetController.sheet.gridOffsets.getRowColumnFromWorld(world.x, world.y);
    setInteractionState({
      ...interactionState,
      cursorPosition: { x: column, y: row },
      keyboardMovePosition: { x: column, y: row },
      multiCursorPosition: {
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
        const world = app.viewport.toWorld(
          e.pageX - (clientBoudingRect?.left || 0),
          e.pageY - (clientBoudingRect?.top || 0)
        );
        const { column, row } = props.sheetController.sheet.gridOffsets.getRowColumnFromWorld(world.x, world.y);

        InsertCSV({
          sheetController: props.sheetController,
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
