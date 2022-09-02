import { useCallback, useEffect, useRef, useState } from 'react';
import useWindowDimensions from '../../hooks/useWindowDimensions';
import type { Viewport } from 'pixi-viewport';
import { Stage } from '@inlet/react-pixi';
import ViewportComponent from './graphics/ViewportComponent';
import { GetCellsDB } from '../gridDB/Cells/GetCellsDB';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLoading } from '../../contexts/LoadingContext';
import useLocalStorage from '../../hooks/useLocalStorage';
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
import { GridLines } from './GridLines';
import { AxesLines } from './AxesLines';
import { GridHeaders } from './GridHeaders';

export default function QuadraticGrid() {
  const { loading } = useLoading();
  const viewportRef = useRef<Viewport>();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  // Live query to update cells
  const cells = useLiveQuery(() => GetCellsDB());

  const [canvasSize, setCanvasSize] = useState<{ width: number, height: number } | undefined>(undefined);
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement>();
  const [headerSize, setHeaderSize] = useState<{ width: number, height: number }>({ width: 0, height: 0 });
  const containerRef = useCallback(node => {
    if (node) {
      setCanvasSize({ width: node.offsetWidth, height: node.offsetHeight });
      setCanvasRef(node);
    }
  }, []);

  useEffect(() => {
    setCanvasSize({ width: canvasRef?.offsetWidth ?? 0, height: canvasRef?.offsetHeight ?? 0 });
  }, [windowWidth, windowHeight, canvasRef]);

  // Local Storage Config
  const [showGridAxes] = useLocalStorage('showGridAxes', true);

  // Interaction State hook
  const [interactionState, setInteractionState] = useRecoilState(
    gridInteractionStateAtom
  );

  // Editor Interaction State hook
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(
    editorInteractionStateAtom
  );

  // Right click menu
  const { state: rightClickMenuState, toggleMenu: toggleRightClickMenu } =
    useMenuState();
  const [rightClickPoint, setRightClickPoint] = useState({ x: 0, y: 0 });

  const pointerEvents = usePointerEvents({
    viewportRef,
    interactionState,
    setInteractionState,
    setEditorInteractionState,
  });

  const setHeaderSizeCallback = useCallback((width: number, height: number) => {
    setHeaderSize({ width, height });
  }, [setHeaderSize]);

  const { onKeyDownCanvas } = useKeyboardCanvas({
    interactionState,
    setInteractionState,
    editorInteractionState,
    setEditorInteractionState,
    viewportRef
  });

  if (loading || !canvasSize) return null;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
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
            window.devicePixelRatio === 1.0 ? 2 : window.devicePixelRatio,
          backgroundColor: 0xffffff,
          antialias: true,
          autoDensity: true,
        }}
        tabIndex={0}
        onKeyDown={(event) => onKeyDownCanvas(event)}
        style={{
          display: 'inline',
          position: 'relative',
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
        >
          {cells?.map((cell) => (
              <CellPixiReact
                key={`${cell.x},${cell.y}`}
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
                array_cells={cell.array_cells}
              ></CellPixiReact>
          ))}
          <GridLines viewportRef={viewportRef} />
          <AxesLines
            viewportRef={viewportRef}
            showGridAxes={showGridAxes}
          />
          <CursorPixiReact
            location={interactionState.cursorPosition}
          ></CursorPixiReact>
          <MultiCursorPixiReact
            originLocation={interactionState.multiCursorPosition.originPosition}
            terminalLocation={
              interactionState.multiCursorPosition.terminalPosition
            }
            visible={interactionState.showMultiCursor}
          ></MultiCursorPixiReact>
          {editorInteractionState.showCodeEditor && (
            <CursorPixiReact
              location={editorInteractionState.selectedCell}
              color={
                editorInteractionState.mode === 'PYTHON'
                  ? colors.cellColorUserPython
                  : colors.independence
              }
            ></CursorPixiReact>
          )}
          <GridHeaders
            viewportRef={viewportRef}
            setHeaderSize={setHeaderSizeCallback}
          />
        </ViewportComponent>
      </Stage>
      <CellInput
        interactionState={interactionState}
        setInteractionState={setInteractionState}
        viewportRef={viewportRef}
      ></CellInput>
      {viewportRef.current && (
        <ViewportEventRegister
          viewport={viewportRef.current}
          headerWidth={headerSize.width}
          headerHeight={headerSize.height}
        ></ViewportEventRegister>
      )}
      <RightClickMenu
        state={rightClickMenuState}
        anchorPoint={rightClickPoint}
        onClose={() => toggleRightClickMenu(false)}
        interactionState={interactionState}
      />
    </div>
  );
}
