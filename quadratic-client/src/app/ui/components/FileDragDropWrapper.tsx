/* eslint-disable @typescript-eslint/no-unused-vars */
import { hasPermissionToEditFile } from '@/app/actions';
import { userMessageAtom } from '@/app/atoms/userMessageAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { isExcelMimeType } from '@/app/helpers/files';
import type { JsCoordinate, JsRenderCodeCell } from '@/app/quadratic-core-types';
import { useFileImport } from '@/app/ui/hooks/useFileImport';
import { Rectangle } from 'pixi.js';
import { isSupportedImageMimeType, isSupportedPdfMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import type { DragEvent, PropsWithChildren } from 'react';
import { useCallback, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';

export const FileDragDropWrapper = (props: PropsWithChildren) => {
  // drag state
  const [dragActive, setDragActive] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);

  const setUserMessageState = useSetRecoilState(userMessageAtom);
  const handleFileImport = useFileImport();

  const getColumnRowFromScreen = useCallback((e: DragEvent<HTMLDivElement>) => {
    const clientBoundingRect = divRef?.current?.getBoundingClientRect();
    const world = pixiApp.viewport.toWorld(
      e.pageX - (clientBoundingRect?.left || 0),
      e.pageY - (clientBoundingRect?.top || 0)
    );
    return sheets.sheet.getColumnRowFromScreen(world.x, world.y);
  }, []);

  const [dragTargetTable, setDragTargetTable] = useState<JsRenderCodeCell | undefined>(undefined);
  const [dragTargetRectangle, setDragTargetRectangle] = useState<Rectangle | undefined>(undefined);
  const moveCursor = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      const { column, row } = getColumnRowFromScreen(e);
      const table = content.cellsSheet.tables.getTableIntersects({ x: column, y: row });
      if (table) {
        setDragTargetTable(table.codeCell);
        const tableBounds = table.tableBounds;
        const viewportBounds = pixiApp.viewport.getVisibleBounds();
        const topLeft = pixiApp.viewport.toScreen(
          Math.max(tableBounds.left, viewportBounds.left),
          Math.max(tableBounds.top, viewportBounds.top)
        );
        const bottomRight = pixiApp.viewport.toScreen(
          Math.min(tableBounds.right, viewportBounds.right),
          Math.min(tableBounds.bottom, viewportBounds.bottom)
        );
        setDragTargetRectangle(
          new Rectangle(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y)
        );
      } else {
        setDragTargetTable(undefined);
        setDragTargetRectangle(undefined);
      }
      const cursor = sheets.sheet.cursor;
      const hasMoved = cursor.position.x !== column || cursor.position.y !== row;
      if (hasMoved) {
        cursor.moveTo(column, row);
      }
    },
    [getColumnRowFromScreen]
  );

  // handle drag events
  const handleDrag = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;

      if (e.type === 'dragenter' && e.dataTransfer.types.includes('Files')) {
        setDragActive(true);
      } else if (e.type === 'dragover') {
        const mimeType = e.dataTransfer.items[0].type;
        if (isExcelMimeType(mimeType)) {
          setUserMessageState({ message: 'Dropped Excel file(s) will be imported as new sheet(s) in this file.' });
        } else {
          setUserMessageState({ message: undefined });
          if (!isSupportedPdfMimeType(mimeType) && !isSupportedImageMimeType(mimeType)) {
            moveCursor(e);
          }
        }
      } else if (e.type === 'dragleave') {
        setDragActive(false);
        setUserMessageState({ message: undefined });
        setDragTargetTable(undefined);
        setDragTargetRectangle(undefined);
      }
    },
    [moveCursor, setUserMessageState]
  );

  // triggers when file is dropped
  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;

      setDragActive(false);
      setUserMessageState({ message: undefined });

      const files = e.dataTransfer.files;
      if (files && files[0]) {
        const sheetId = sheets.current;
        const cursor = sheets.getCursorPosition();
        const { column, row } = getColumnRowFromScreen(e);
        const insertAt = { x: column, y: row } as JsCoordinate;
        handleFileImport({ files: Array.from(files), insertAt, sheetId, cursor });
      }
    },
    [getColumnRowFromScreen, handleFileImport, setUserMessageState]
  );

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
      {dragTargetRectangle && dragTargetTable && (
        <div
          style={{
            position: 'absolute',
            width: dragTargetRectangle.width,
            height: dragTargetRectangle.height,
            top: dragTargetRectangle.top,
            left: dragTargetRectangle.left,
            border: '4px dashed #000',
            opacity: 0.75,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
          }}
        >
          <div className="padding-2 rounded-md bg-white p-2 text-2xl font-bold">
            Replace table {dragTargetTable.name} with this file
          </div>
        </div>
      )}
      {dragActive && (
        <div
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
