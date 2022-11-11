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
import { GetFormatDB } from '../gridDB/Cells/GetFormatDB';

interface IProps {
  app?: PixiApp;
  setApp: (app: PixiApp) => void;
}

export default function QuadraticGrid(props: IProps) {
  const { loading } = useLoading();

  useEffect(() => props.setApp(new PixiApp()), []);

  const [container, setContainer] = useState<HTMLDivElement>();
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setContainer(node);
  }, []);
  useEffect(() => {
    if (props.app && container) props.app.attach(container);
  }, [props.app, container]);

  // Live query to update cells
  const cells = useLiveQuery(() => GetCellsDB());
  const format = useLiveQuery(() => GetFormatDB());
  useEffect(() => {
    if (props.app) {
      props.app.grid.populate(cells, format);
      props.app.cells.dirty = true;
    }
  }, [props.app, cells, format]);

  const { headings } = useHeadings(props.app);
  useEffect(() => {
    if (props.app && headings) {
      props.app.gridOffsets.populate(headings.columns, headings.rows);
    }
  }, [props.app, headings]);

  useEffect(() => {
    if (props.app && headings) {
      props.app.gridOffsets.populate(headings.columns, headings.rows);
    }
  }, [props.app, headings]);

  // Interaction State hook
  const [interactionState, setInteractionState] = useRecoilState(gridInteractionStateAtom);
  useEffect(() => {
    props.app?.settings.updateInteractionState(interactionState, setInteractionState);
    ensureVisible({
      app: props.app,
      interactionState,
    });
  }, [props.app, props.app?.settings, interactionState, setInteractionState]);

  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  useEffect(() => {
    props.app?.settings.updateEditorInteractionState(editorInteractionState, setEditorInteractionState);
  }, [props.app?.settings, editorInteractionState, setEditorInteractionState]);

  const [zoomState, setZoomState] = useRecoilState(zoomStateAtom);
  useEffect(() => {
    props.app?.settings.updateZoom(zoomState, setZoomState);
  }, [props.app?.settings, zoomState, setZoomState]);

  // Right click menu
  const { state: rightClickMenuState, toggleMenu: toggleRightClickMenu } = useMenuState();
  const [rightClickPoint, setRightClickPoint] = useState({ x: 0, y: 0 });

  const { onKeyDown } = useKeyboard({
    interactionState,
    setInteractionState,
    editorInteractionState,
    setEditorInteractionState,
    app: props.app,
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
        app={props.app}
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
