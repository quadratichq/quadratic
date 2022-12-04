import { useCallback, useEffect, useState } from 'react';
import { useLoading } from '../../contexts/LoadingContext';
import { gridInteractionStateAtom } from '../../atoms/gridInteractionStateAtom';
import { editorInteractionStateAtom } from '../../atoms/editorInteractionStateAtom';
import { useRecoilState } from 'recoil';
import { useMenuState } from '@szhsin/react-menu';
import { PixiApp } from './pixiApp/PixiApp';
import { zoomStateAtom } from '../../atoms/zoomStateAtom';
import { useKeyboard } from './interaction/keyboard/useKeyboard';
import { ensureVisible } from './interaction/ensureVisible';
import { CellInput } from './interaction/CellInput';
import RightClickMenu from '../../ui/menus/RightClickMenu';
import { Sheet } from '../gridDB/sheet';

interface IProps {
  sheet: Sheet;
  app?: PixiApp;
  setApp: (app: PixiApp) => void;
}

export default function QuadraticGrid(props: IProps) {
  const { loading } = useLoading();

  const { setApp } = props;

  useEffect(() => setApp(new PixiApp()), [setApp]);

  const [container, setContainer] = useState<HTMLDivElement>();
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setContainer(node);
  }, []);
  useEffect(() => {
    if (props.app && container) props.app.attach(container);
  }, [props.app, container]);

  // Live query to update cells
  // const cells = useLiveQuery(() => GetCellsDB());
  // const format = useLiveQuery(() => GetFormatDB());
  // const borders = useLiveQuery(() => GetBordersDB());

  // useEffect(() => {
  //   if (cells && format && borders) {
  //     props.app.borders.populate(borders);
  //     props.app.grid.populate(cells, format);
  //     props.app.quadrants.build();
  //     props.app.cells.dirty = true;
  //   }
  // }, [props.app, cells, format, borders]);

  // const { headings } = useHeadings(props.app);
  // useEffect(() => {
  //   if (props.app && headings) {
  //     props.app.gridOffsets.populate(headings.columns, headings.rows);
  //   }
  // }, [props.app, headings]);

  // useEffect(() => {
  //   if (props.app && headings) {
  //     props.app.gridOffsets.populate(headings.columns, headings.rows);
  //   }
  // }, [props.app, headings]);

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
