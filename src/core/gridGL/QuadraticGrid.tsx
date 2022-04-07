import { useRef } from 'react';
import useWindowDimensions from '../../hooks/useWindowDimensions';
import type { Viewport } from 'pixi-viewport';
import { Stage } from '@inlet/react-pixi';
import ViewportComponent from './graphics/ViewportComponent';
import { GetCellsDB } from '../gridDB/Cells/GetCellsDB';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLoading } from '../../contexts/LoadingContext';
import useLocalStorage from '../../hooks/useLocalStorage';
import CellPixiReact from './graphics/CellPixiReact';
import AxesPixiReact from './graphics/AxesPixiReact';
import CursorPixiReact from './graphics/CursorPixiReact';
import MultiCursorPixiReact from './graphics/MultiCursorPixiReact';
import { gridInteractionStateAtom } from '../../atoms/gridInteractionStateAtom';
import { useRecoilState } from 'recoil';
import { CELL_WIDTH, CELL_HEIGHT } from '../../constants/gridConstants';
import { onKeyDownCanvas } from './interaction/onKeyDownCanvas';
import { onMouseDownCanvas } from './interaction/onMouseDownCanvas';
import { CellInput } from './interaction/CellInput';
import { onDoubleClickCanvas } from './interaction/onDoubleClickCanvas';

export default function QuadraticGrid() {
  let navigate = useNavigate();
  const { loading } = useLoading();
  const viewportRef = useRef<Viewport>();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const cells = useLiveQuery(() => GetCellsDB());

  // Local Storage Config
  const [showGridAxes] = useLocalStorage('showGridAxes', true);

  // Interaction State hook
  const [interactionState, setInteractionState] = useRecoilState(
    gridInteractionStateAtom
  );

  // When the cursor moves ensure it is visible
  viewportRef.current?.ensureVisible(
    interactionState.cursorPosition.x * CELL_WIDTH,
    interactionState.cursorPosition.y * CELL_HEIGHT - 40,
    CELL_WIDTH,
    CELL_HEIGHT * 4,
    false
  );

  return (
    <>
      <Stage
        id="QuadraticCanvasID"
        height={windowHeight}
        width={windowWidth}
        options={{
          resizeTo: window,
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
            navigate,
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
            navigate
          );
        }}
        style={{ display: loading ? 'none' : 'inline' }}
        // Disable rendering on each frame
        raf={false}
        // Render on each state change
        renderOnComponentChange={true}
      >
        <ViewportComponent
          screenWidth={windowWidth}
          screenHeight={windowHeight}
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
        </ViewportComponent>
      </Stage>
      <CellInput
        interactionState={interactionState}
        setInteractionState={setInteractionState}
        viewportRef={viewportRef}
      ></CellInput>
    </>
  );
}
