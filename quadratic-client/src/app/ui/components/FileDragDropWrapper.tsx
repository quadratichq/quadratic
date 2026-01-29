import { hasPermissionToEditFile } from '@/app/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Table } from '@/app/gridGL/cells/tables/Table';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { isExcelMimeType } from '@/app/helpers/files';
import type { JsCoordinate, JsRenderCodeCell } from '@/app/quadratic-core-types';
import { useFileImport } from '@/app/ui/hooks/useFileImport';
import { Rectangle } from 'pixi.js';
import { isSupportedImageMimeType, isSupportedPdfMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import type { DragEvent, PropsWithChildren } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UserMessage {
  targetRectangle: Rectangle;
  table?: JsRenderCodeCell;
  message: string;
}

export const FileDragDropWrapper = (props: PropsWithChildren) => {
  // drag state
  const [dragActive, setDragActive] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);

  const handleFileImport = useFileImport();

  const getColumnRowFromScreen = useCallback((e: DragEvent<HTMLDivElement>) => {
    const clientBoundingRect = divRef?.current?.getBoundingClientRect();
    const world = pixiApp.viewport.toWorld(
      e.pageX - (clientBoundingRect?.left || 0),
      e.pageY - (clientBoundingRect?.top || 0)
    );
    return sheets.sheet.getColumnRowFromScreen(world.x, world.y);
  }, []);

  const [userMessage, setUserMessage] = useState<UserMessage | undefined>(undefined);
  const setScreenUserMessage = useCallback((message: string | undefined, table?: Table) => {
    if (!message) {
      setUserMessage(undefined);
      return;
    }
    const viewportBounds = pixiApp.viewport.getVisibleBounds();
    let topLeft: JsCoordinate;
    let bottomRight: JsCoordinate;
    const gridHeadings = content.headings.headingSize;
    if (table) {
      const tableBounds = table.tableBounds;
      topLeft = pixiApp.viewport.toScreen(
        Math.max(tableBounds.left, viewportBounds.left + gridHeadings.width),
        Math.max(tableBounds.top, viewportBounds.top + gridHeadings.height)
      );
      bottomRight = pixiApp.viewport.toScreen(
        Math.min(tableBounds.right, viewportBounds.right),
        Math.min(tableBounds.bottom, viewportBounds.bottom)
      );
    } else {
      topLeft = pixiApp.viewport.toScreen(
        viewportBounds.left + gridHeadings.width,
        viewportBounds.top + gridHeadings.height
      );
      bottomRight = pixiApp.viewport.toScreen(viewportBounds.right, viewportBounds.bottom);
    }
    const targetRectangle = new Rectangle(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    setUserMessage({ targetRectangle, message, table: table?.codeCell });
  }, []);

  const moveCursor = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      const { column, row } = getColumnRowFromScreen(e);
      const table = content.cellsSheet.tables.getTableIntersects({ x: column, y: row });
      if (table) {
        setScreenUserMessage(`Replace table ${table.codeCell.name} with this file`, table);
      } else {
        setScreenUserMessage(undefined);
      }
      const cursor = sheets.sheet.cursor;
      const hasMoved = cursor.position.x !== column || cursor.position.y !== row;
      if (hasMoved) {
        cursor.moveTo(column, row);
      }
    },
    [getColumnRowFromScreen, setScreenUserMessage]
  );

  // Handle escape key press
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragActive) {
        setDragActive(false);
        setScreenUserMessage(undefined);
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [dragActive, setScreenUserMessage]
  );

  // Add/remove keyboard event listener
  useEffect(() => {
    if (dragActive) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [dragActive, handleKeyDown]);

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
          setScreenUserMessage('Dropped Excel file(s) will be imported as new sheet(s) in this file.');
          // todo: add support for multiple files
          // } else if (e.dataTransfer.items.length > 1) {
          //   setScreenUserMessage('Dropped multiple files will be imported as new sheets in this file.');
        } else {
          setScreenUserMessage(undefined);
          if (!isSupportedPdfMimeType(mimeType) && !isSupportedImageMimeType(mimeType)) {
            moveCursor(e);
          }
        }
      } else if (e.type === 'dragleave') {
        setDragActive(false);
        setScreenUserMessage(undefined);
      }
    },
    [moveCursor, setScreenUserMessage]
  );

  // triggers when file is dropped
  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;

      setDragActive(false);
      setScreenUserMessage(undefined);

      const files = e.dataTransfer.files;
      if (files && files[0]) {
        const sheetId = sheets.current;
        const cursor = sheets.getCursorPosition();
        let { column, row } = getColumnRowFromScreen(e);
        if (userMessage?.table) {
          column = userMessage.table.x;
          row = userMessage.table.y;
        }
        const insertAt = { x: column, y: row } as JsCoordinate;
        handleFileImport({ files: Array.from(files), insertAt, sheetId, cursor, isOverwrite: !!userMessage?.table });
      }
    },
    [getColumnRowFromScreen, handleFileImport, setScreenUserMessage, userMessage?.table]
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
      {userMessage && (
        <div
          className="flex items-center justify-center border-4 border-dashed border-primary bg-background/80"
          style={{
            position: 'absolute',
            width: userMessage.targetRectangle.width,
            height: userMessage.targetRectangle.height,
            top: userMessage.targetRectangle.top,
            left: userMessage.targetRectangle.left,
          }}
        >
          <div className="padding-2 rounded-md bg-white p-2 text-2xl font-bold">{userMessage.message}</div>
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
