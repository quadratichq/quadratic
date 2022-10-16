import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useWindowDimensions from '../../hooks/useWindowDimensions';
import type { Viewport } from 'pixi-viewport';
import { Stage } from '@inlet/react-pixi';
import ViewportComponent from './graphics/ViewportComponent';
import { GetCellsDB } from '../gridDB/Cells/GetCellsDB';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLoading } from '../../contexts/LoadingContext';
import CellPixiReact from './graphics/CellPixiReact';
import CursorPixiReact from './graphics/CursorPixiReact';
import MultiCursorPixiReact from './graphics/MultiCursorPixiReact';
import { gridInteractionStateAtom } from '../../atoms/gridInteractionStateAtom';
import { editorInteractionStateAtom } from '../../atoms/editorInteractionStateAtom';
import { useRecoilState } from 'recoil';
import { useKeyboardCanvas } from './interaction/useKeyboardCanvas';
import { usePointerEvents } from './interaction/usePointerEvents';
import { CellInput } from './interaction/CellInput';
import { colors } from '../../theme/colors';
import { useMenuState } from '@szhsin/react-menu';
import RightClickMenu from '../../ui/menus/RightClickMenu';
import { ViewportEventRegister } from './interaction/ViewportEventRegister';
import useLocalStorage from '../../hooks/useLocalStorage';
import { gridHeadingsGlobals } from './graphics/gridHeadings';
import { axesLinesGlobals } from './graphics/axesLines';
import { gridLinesGlobals } from './graphics/gridLines';
import { Size } from './types/size';
import { Cell } from '../gridDB/db';
import { gridOffsets } from '../gridDB/gridOffsets';
import { GetHeadingsDB } from '../gridDB/Cells/GetHeadingsDB';
import { CELL_HEIGHT, CELL_WIDTH } from '../../constants/gridConstants';

interface CellSized extends Cell {
  xPosition?: number;
  yPosition?: number
  width?: number;
  height?: number;
}

export default function QuadraticGrid() {
  const { loading } = useLoading();
  const viewportRef = useRef<Viewport>();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  // Live query to update cells
  const cellsWithoutPosition = useLiveQuery(() => GetCellsDB());
  const headings = useLiveQuery(() => GetHeadingsDB());
  const [canvasSize, setCanvasSize] = useState<Size | undefined>(undefined);
  const [container, setContainer] = useState<HTMLDivElement>();
  const containerRef = useCallback((node) => {
    if (node) {
      setCanvasSize({ width: node.offsetWidth, height: node.offsetHeight });
      setContainer(node);
    }
  }, []);

  const cells: CellSized[] = useMemo(() => {
    if (headings) {
      gridOffsets.populate(headings.columns, headings.rows);
    }
    if (cellsWithoutPosition) {
      // forces a refresh of the viewport after gridOffsets updates
      if (viewportRef.current) {
        viewportRef.current.emit("moved");
        viewportRef.current.dirty = true;
      }
      return cellsWithoutPosition.map(cell => {
        const result = gridOffsets.getCell(cell.x, cell.y);
        return {
          ...cell,
          xPosition: result.x,
          yPosition: result.y,
          width: result.width,
          height: result.height,
        };
      });
    }
    return [];
  }, [cellsWithoutPosition, headings]);

  useEffect(() => {
    setCanvasSize({
      width: container?.offsetWidth ?? 0,
      height: container?.offsetHeight ?? 0,
    });
  }, [windowWidth, windowHeight, container]);

  // Local Storage Config
  const [showGridAxes] = useLocalStorage('showGridAxes', true);
  const [showHeadings] = useLocalStorage('showHeadings', true);
  const [showGridLines] = useLocalStorage('showGridLines', true);
  const [showCellTypeOutlines] = useLocalStorage('showCellTypeOutlines', true);

  const forceRender = (): void => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.emit('zoomed');
    viewport.dirty = true;
  };

  // render on canvasSize update (when window is resized)
  useEffect(() => {
    forceRender();
  }, [canvasSize]);

  useEffect(() => {
    axesLinesGlobals.showGridAxes = showGridAxes;
    gridHeadingsGlobals.showHeadings = showHeadings;
    gridLinesGlobals.show = showGridLines;
    forceRender();
  }, [showGridAxes, showHeadings, showGridLines]);

  // Interaction State hook
  const [interactionState, setInteractionState] = useRecoilState(gridInteractionStateAtom);

  useEffect(() => {
    gridHeadingsGlobals.interactionState = interactionState;
    if (viewportRef.current) {
      viewportRef.current.dirty = true;
    }
  }, [interactionState]);

  // Editor Interaction State hook
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);

  const { cursorX, cursorY, cursorWidth, cursorHeight } = useMemo(() => {
    if (!headings) return { cursorX: 0, cursorY: 0, cursorWidth: CELL_WIDTH, cursorHeight: CELL_HEIGHT };
    const cell = interactionState.cursorPosition;
    const column = gridOffsets.getColumnPlacement(cell.x);
    const row = gridOffsets.getRowPlacement(cell.y);
    return {
      cursorX: column.x,
      cursorY: row.y,
      cursorWidth: column.width,
      cursorHeight: row.height,
    };
  }, [interactionState.cursorPosition, headings])

  const multiCursor = useMemo(() => {
    if (!headings || !interactionState.showMultiCursor) return;
    const start = interactionState.multiCursorPosition.originPosition;
    const startColumn = gridOffsets.getColumnPlacement(start.x);
    const startRow = gridOffsets.getRowPlacement(start.y);
    const end = interactionState.multiCursorPosition.terminalPosition;
    const endColumn = gridOffsets.getColumnPlacement(end.x);
    const endRow = gridOffsets.getRowPlacement(end.y);
    return {
      x: startColumn.x,
      y: startRow.y,
      width: endColumn.x + endColumn.width - startColumn.x,
      height: endRow.y + endRow.height - startRow.y,
    }
  }, [interactionState.multiCursorPosition, interactionState.showMultiCursor, headings])

  // Right click menu
  const { state: rightClickMenuState, toggleMenu: toggleRightClickMenu } = useMenuState();
  const [rightClickPoint, setRightClickPoint] = useState({ x: 0, y: 0 });

  const pointerEvents = usePointerEvents({
    viewportRef,
    interactionState,
    setInteractionState,
    setEditorInteractionState,
  });

  const { onKeyDownCanvas } = useKeyboardCanvas({
    interactionState,
    setInteractionState,
    editorInteractionState,
    setEditorInteractionState,
    viewportRef,
  });

  if (loading || !canvasSize || !headings || !cellsWithoutPosition) return null;

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
      <Stage
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
          WebkitTapHighlightColor: 'rgba(255, 255, 255, 0)' /* mobile webkit */,
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
            ></CellPixiReact>
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
      />
    </div>
  );
}
