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
import { zoomStateAtom } from '../../atoms/zoomStateAtom';
import { useKeyboard } from './interaction/keyboard/useKeyboard';
import { ensureVisible } from './interaction/ensureVisible';
import { CellInput } from './interaction/CellInput';
import RightClickMenu from '../../ui/menus/RightClickMenu';

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
  }, [app, container]);

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

  // Interaction State hook
  const [interactionState, setInteractionState] = useRecoilState(gridInteractionStateAtom);
  useEffect(() => {
    app?.settings.updateInteractionState(interactionState, setInteractionState);
    ensureVisible({
      app,
      interactionState,
    });
  }, [app, app?.settings, interactionState, setInteractionState]);

  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  useEffect(() => {
    app?.settings.updateEditorInteractionState(editorInteractionState, setEditorInteractionState);
  }, [app?.settings, editorInteractionState, setEditorInteractionState]);

  const [zoomState, setZoomState] = useRecoilState(zoomStateAtom);
  useEffect(() => {
    app?.settings.updateZoom(zoomState, setZoomState);
  }, [app?.settings, zoomState, setZoomState]);

  // Right click menu
  const { state: rightClickMenuState, toggleMenu: toggleRightClickMenu } = useMenuState();
  const [rightClickPoint, setRightClickPoint] = useState({ x: 0, y: 0 });

  const { onKeyDown } = useKeyboard({
    interactionState,
    setInteractionState,
    editorInteractionState,
    setEditorInteractionState,
    app,
  });

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
      onKeyDown={onKeyDown}
    >
      <CellInput
        interactionState={interactionState}
        setInteractionState={setInteractionState}
        container={container}
        app={app}
      />
      <RightClickMenu
        state={rightClickMenuState}
        anchorPoint={rightClickPoint}
        onClose={() => toggleRightClickMenu(false)}
        interactionState={interactionState}
      />
    </div>
  );
}
