import { createRef, useRef, useState, useLayoutEffect } from 'react';
import useWindowDimensions from '../../hooks/useWindowDimensions';
import type { Viewport } from 'pixi-viewport';
import { Stage } from '@inlet/react-pixi';
import ViewportComponent from './graphics/ViewportComponent';
import { GetCellsDB } from '../gridDB/Cells/GetCellsDB';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLoading } from '../../contexts/LoadingContext';
import useLocalStorage from '../../hooks/useLocalStorage';
import CellPixiReact from './graphics/CellPixiReact';
import AxesPixiReact from './graphics/AxesPixiReact';
import CursorPixiReact from './graphics/CursorPixiReact';
import MultiCursorPixiReact from './graphics/MultiCursorPixiReact';
import { gridInteractionStateAtom } from '../../atoms/gridInteractionStateAtom';
import { editorInteractionStateAtom } from '../../atoms/editorInteractionStateAtom';
import { useRecoilState } from 'recoil';
import { onKeyDownCanvas } from './interaction/onKeyDownCanvas';
import { onMouseDownCanvas } from './interaction/onMouseDownCanvas';
import { CellInput } from './interaction/CellInput';
import { onDoubleClickCanvas } from './interaction/onDoubleClickCanvas';
import { colors } from '../../theme/colors';
import { useMenuState } from '@szhsin/react-menu';
import RightClickMenu from '../../ui/menus/RightClickMenu';

import { ViewportEventRegister } from './interaction/ViewportEventRegister';

interface QuadraticGridProps {
  loading: boolean;
}

export default function QuadraticGrid(props: QuadraticGridProps) {
  const { loading } = props;
  const viewportRef = useRef<Viewport>();
  const stageContainerRef = createRef<HTMLDivElement>();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  // Live query to update cells
  const cells = useLiveQuery(() => GetCellsDB());

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

  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    setWidth(stageContainerRef?.current?.offsetWidth || 100);
    setHeight(stageContainerRef?.current?.offsetHeight || 100);
  }, [stageContainerRef]);

  console.log('width ', width, ' height ', height);

  return (
    <div
      style={{
        // backgroundColor: 'green',
        display: 'flex',
        flexGrow: 1,
        // height: '100%',
        // position: 'absolute',
        overflow: 'hidden',
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        setRightClickPoint({ x: event.clientX, y: event.clientY });
        toggleRightClickMenu(true);
      }}
      ref={stageContainerRef}
    >
      <Stage
        id="QuadraticCanvasID"
        style={{ display: loading ? 'none' : 'block', position: 'static' }}
        width={width}
        height={height}
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
        onKeyDown={(event) => {
          onKeyDownCanvas(
            event,
            interactionState,
            setInteractionState,
            editorInteractionState,
            setEditorInteractionState,
            viewportRef
          );
        }}
        onMouseDown={(event) => {
          onMouseDownCanvas(
            event,
            interactionState,
            setInteractionState,
            viewportRef
          );
        }}
        onDoubleClick={(event) => {
          onDoubleClickCanvas(
            event,
            interactionState,
            setInteractionState,
            editorInteractionState,
            setEditorInteractionState
          );
        }}
        // Disable rendering on each frame
        raf={false}
        // Render on each state change
        renderOnComponentChange={true}
      >
        <ViewportComponent
          screenWidth={width}
          screenHeight={height}
          viewportRef={viewportRef}
        >
          {!loading &&
            cells?.map((cell) => (
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
          <AxesPixiReact visible={showGridAxes}></AxesPixiReact>
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
