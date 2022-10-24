import { useCallback, useEffect, useState } from 'react';
import { GetCellsDB } from '../gridDB/Cells/GetCellsDB';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLoading } from '../../contexts/LoadingContext';
import { gridInteractionStateAtom } from '../../atoms/gridInteractionStateAtom';
import { editorInteractionStateAtom } from '../../atoms/editorInteractionStateAtom';
import { useRecoilState } from 'recoil';
import { useMenuState } from '@szhsin/react-menu';
import { PixiApp } from './pixiApp/PixiApp';
import { useHeadings } from '../gridDB/useHeadings';
import { useGridSettings } from './useGridSettings';

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
  useEffect(() => {
    if (app) {
      app.grid.populate(cells);
      app.cells.dirty = true;
    }
  }, [app, cells]);

  const { headings } = useHeadings(app);
  useEffect(() => {
    if (app && headings) {
      app.gridOffsets.populate(headings.columns, headings.rows);
    }
  }, [app, headings]);


  const settings = useGridSettings();

  // Interaction State hook
  const [interactionState, setInteractionState] = useRecoilState(gridInteractionStateAtom);
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  useEffect(() => {
    if (app) {
      app.settings.populate({
        interactionState,
        setInteractionState,
        editorInteractionState,
        setEditorInteractionState,
      });
    }
  }, [app, settings, interactionState, setInteractionState, editorInteractionState, setEditorInteractionState]);


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
      {/*<CellInput
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
