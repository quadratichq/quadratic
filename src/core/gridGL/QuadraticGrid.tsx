import { useCallback, useEffect, useRef, useState } from 'react';
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
import { gridHeadingsProps } from './graphics/gridHeadings';
import { axesLinesProps } from './graphics/axesLines';
import { Size } from './types/size';

export default function QuadraticGrid() {
  const { loading } = useLoading();
  const viewportRef = useRef<Viewport>();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  // Live query to update cells
  const cells = useLiveQuery(() => GetCellsDB());
  const [canvasSize, setCanvasSize] = useState<Size | undefined>(undefined);
  const [container, setContainer] = useState<HTMLDivElement>();
  const [headerSize, setHeaderSize] = useState<Size>({ width: 0, height: 0 });
  const containerRef = useCallback((node) => {
    if (node) {
      setCanvasSize({ width: node.offsetWidth, height: node.offsetHeight });
      setContainer(node);
    }
  }, []);

  useEffect(() => {
    setCanvasSize({
      width: container?.offsetWidth ?? 0,
      height: container?.offsetHeight ?? 0,
    });
  }, [windowWidth, windowHeight, container]);

  // Local Storage Config
  const [showGridAxes] = useLocalStorage('showGridAxes', true);
  const [showHeadings] = useLocalStorage('showHeadings', true);

  const forceRender = (): void => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.emit('zoomed');
    viewport.dirty = true;
  };

  useEffect(() => {
    axesLinesProps.showGridAxes = showGridAxes;
    forceRender();
  }, [showGridAxes]);

  useEffect(() => {
    gridHeadingsProps.showHeadings = showHeadings;
    forceRender();
  }, [showHeadings]);

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

  const setHeaderSizeCallback = useCallback(
    (width: number, height: number) => {
      if (headerSize.width !== width || headerSize.height !== height) {
        // setHeaderSize({ width, height });
      }
    },
    [headerSize, setHeaderSize]
  );

  const { onKeyDownCanvas } = useKeyboardCanvas({
    interactionState,
    setInteractionState,
    editorInteractionState,
    setEditorInteractionState,
    viewportRef,
    headerSize,
  });

  if (loading || !canvasSize) return null;

  return (
    <div
      className="canvas-container"
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        outline: 'none',
        overflow: 'hidden',
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
          // display: 'inline',
          // position: 'relative',
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
          setHeaderSize={setHeaderSizeCallback}
          showHeadings={showHeadings}
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
          <CursorPixiReact
            viewportRef={viewportRef}
            location={interactionState.cursorPosition}
          ></CursorPixiReact>
          <MultiCursorPixiReact
            viewportRef={viewportRef}
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
        </ViewportComponent>
      </Stage>
      <CellInput
        interactionState={interactionState}
        setInteractionState={setInteractionState}
        viewportRef={viewportRef}
        headerSize={headerSize}
        container={container}
      ></CellInput>
      {viewportRef.current && (
        <ViewportEventRegister
          viewport={viewportRef.current}
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
