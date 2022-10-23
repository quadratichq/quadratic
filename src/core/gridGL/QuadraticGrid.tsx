import { useCallback, useEffect, useState } from 'react';
import { GetCellsDB } from '../gridDB/Cells/GetCellsDB';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLoading } from '../../contexts/LoadingContext';
import { gridInteractionStateAtom } from '../../atoms/gridInteractionStateAtom';
import { editorInteractionStateAtom } from '../../atoms/editorInteractionStateAtom';
import { useRecoilState } from 'recoil';
import { useMenuState } from '@szhsin/react-menu';
import { Cell } from '../gridDB/db';
import { PixiApp } from './pixiApp/PixiApp';
import { useHeadings } from '../gridDB/useHeadings';
import { useGridSettings } from './useGridSettings';

interface CellSized extends Cell {
  xPosition?: number;
  yPosition?: number
  width?: number;
  height?: number;
}

export default function QuadraticGrid() {
  const { loading } = useLoading();

  const [app, setApp] = useState<PixiApp>();
  useEffect(() => setApp(new PixiApp()), []);

  const [container, setContainer] = useState<HTMLDivElement>();
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setContainer(node);
  }, []);
  useEffect(() => {
    if (app && container) app.attach(container);
  }, [app, container])


  // Live query to update cells
  const cells = useLiveQuery(() => GetCellsDB());

  const { headings, updateHeadings } = useHeadings(app);
  useEffect(() => {
    if (app && headings) {
      app.gridOffsets.populate(headings.columns, headings.rows);
    }
  }, [app, headings]);

  // const cells: CellSized[] = useMemo(() => {
  //   if (cellsWithoutPosition) {
  //     return cellsWithoutPosition.map(cell => {
  //       const result = gridOffsets.getCell(cell.x, cell.y);
  //       if (headingResizing) {
  //         if (headingResizing.width && cell.x === headingResizing.x) {
  //           result.width = headingResizing.width;
  //         } else if (headingResizing.height && cell.y === headingResizing.y) {
  //           result.height = headingResizing.height;
  //         }
  //       }
  //       return {
  //         ...cell,
  //         xPosition: result.x,
  //         yPosition: result.y,
  //         width: result.width,
  //         height: result.height,
  //       };
  //     });
  //   }
  //   return [];
  //   // headingResizing is used by gridOffsets
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [cellsWithoutPosition, headings]);

  // Local Storage Config
  const settings = useGridSettings();

  // Interaction State hook
  const [interactionState, setInteractionState] = useRecoilState(gridInteractionStateAtom);
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  useEffect(() => {
    if (app) {
      app.settings.populate({
        settings,
        interactionState,
        editorInteractionState,
      });
    }
  }, [app, settings, interactionState, editorInteractionState]);

  // Editor Interaction State hook

  // const { cursorX, cursorY, cursorWidth, cursorHeight } = useMemo(() => {
  //   if (!headings) return { cursorX: 0, cursorY: 0, cursorWidth: CELL_WIDTH, cursorHeight: CELL_HEIGHT };
  //   const cell = interactionState.cursorPosition;
  //   const column = gridOffsets.getColumnPlacement(cell.x);
  //   const row = gridOffsets.getRowPlacement(cell.y);
  //   return {
  //     cursorX: column.x,
  //     cursorY: row.y,
  //     cursorWidth: column.width,
  //     cursorHeight: row.height,
  //   };
  //   // headingResizing is used by gridOffsets
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [interactionState.cursorPosition, headings, headingResizing])

  // const multiCursor = useMemo(() => {
  //   if (!headings || !interactionState.showMultiCursor) return;
  //   const start = interactionState.multiCursorPosition.originPosition;
  //   const startColumn = gridOffsets.getColumnPlacement(start.x);
  //   const startRow = gridOffsets.getRowPlacement(start.y);
  //   const end = interactionState.multiCursorPosition.terminalPosition;
  //   const endColumn = gridOffsets.getColumnPlacement(end.x);
  //   const endRow = gridOffsets.getRowPlacement(end.y);
  //   return {
  //     x: startColumn.x,
  //     y: startRow.y,
  //     width: endColumn.x + endColumn.width - startColumn.x,
  //     height: endRow.y + endRow.height - startRow.y,
  //   }
  //   // headingResizing is used by gridOffsets
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [interactionState.multiCursorPosition, interactionState.showMultiCursor, headings, headingResizing])

  // Right click menu
  const { state: rightClickMenuState, toggleMenu: toggleRightClickMenu } = useMenuState();
  const [rightClickPoint, setRightClickPoint] = useState({ x: 0, y: 0 });

  // const pointerEvents = usePointerEvents({
  //   viewportRef,
  //   interactionState,
  //   setInteractionState,
  //   setEditorInteractionState,
  //   setHeadingResizing: setHeadingResizingCallback,
  //   headingResizing,
  //   saveHeadingResizing,
  // });

  // const { onKeyDownCanvas } = useKeyboardCanvas({
  //   interactionState,
  //   setInteractionState,
  //   editorInteractionState,
  //   setEditorInteractionState,
  //   viewportRef,
  // });

  if (loading) return null;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        outline: 'none',
        overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent',
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        setRightClickPoint({ x: event.clientX, y: event.clientY });
        toggleRightClickMenu(true);
      }}
    >
      {/* <Stage
        id="QuadraticCanvasID"
        width={canvasSize.width}
        height={canvasSize.height}
        options={{
          // resizeTo: window,
          resolution:
            // Always use 2 instead of 1. Better resolution.
            window.devicePixelRatio <= 1.0 ? 2 : window.devicePixelRatio,
          backgroundColor: 0xffffff,
          antialias: true,
          autoDensity: true,
        }}
        tabIndex={0}
        onKeyDown={(event) => onKeyDownCanvas(event)}
        style={{
          outline: 'none',
          WebkitTapHighlightColor: 'rgba(255, 255, 255, 0)',
        }}
        // Disable rendering on each frame
        raf={false}
        // Render on each state change
        renderOnComponentChange={true}
      >
        <ViewportComponent
          screenWidth={canvasSize.width}
          screenHeight={canvasSize.height}
          viewportRef={viewportRef}
          onPointerDown={pointerEvents.onPointerDown}
          onPointerMove={pointerEvents.onPointerMove}
          onPointerUp={pointerEvents.onPointerUp}
          showHeadings={showHeadings}
        >
          {cells?.map((cell) => (
            <CellPixiReact
              key={`${cell.x},${cell.y}`}
              xPosition={cell.xPosition}
              yPosition={cell.yPosition}
              width={cell.width}
              height={cell.height}
              x={cell.x}
              y={cell.y}
              text={cell.value}
              type={cell.type}
              renderText={
                // Hide the cell text if the input is currently editing this cell
                !(
                  interactionState.showInput &&
                  interactionState.cursorPosition.x === cell.x &&
                  interactionState.cursorPosition.y === cell.y
                )
              }
              showCellTypeOutlines={showCellTypeOutlines}
              array_cells={cell.array_cells}
            />
          ))}
          <CursorPixiReact
            viewportRef={viewportRef}
            x={cursorX}
            y={cursorY}
            width={cursorWidth}
            height={cursorHeight}
          />
          <MultiCursorPixiReact
            viewportRef={viewportRef}
            multiCursor={multiCursor}
            visible={interactionState.showMultiCursor}
          ></MultiCursorPixiReact>
          {editorInteractionState.showCodeEditor && (
            <CursorPixiReact
              x={cursorX}
              y={cursorY}
              width={cursorWidth}
              height={cursorHeight}
              color={editorInteractionState.mode === 'PYTHON' ? colors.cellColorUserPython : colors.independence}
            />
          )}
        </ViewportComponent>
      </Stage>
      <CellInput
        interactionState={interactionState}
        setInteractionState={setInteractionState}
        viewportRef={viewportRef}
        container={container}
      ></CellInput>
      {viewportRef.current && <ViewportEventRegister viewport={viewportRef.current}></ViewportEventRegister>}
      <RightClickMenu
        state={rightClickMenuState}
        anchorPoint={rightClickPoint}
        onClose={() => toggleRightClickMenu(false)}
        interactionState={interactionState}
      /> */}
    </div>
  );
}
