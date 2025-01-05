import { events } from '@/app/events/events';
import { Annotations } from '@/app/gridGL/HTMLGrid/annotations/Annotations';
import { AskAISelection } from '@/app/gridGL/HTMLGrid/askAISelection/AskAISelection';
import { CodeHint } from '@/app/gridGL/HTMLGrid/CodeHint';
import { CodeRunning } from '@/app/gridGL/HTMLGrid/codeRunning/CodeRunning';
import { GridContextMenu } from '@/app/gridGL/HTMLGrid/contextMenus/GridContextMenu';
import { TableColumnContextMenu } from '@/app/gridGL/HTMLGrid/contextMenus/TableColumnContextMenu';
import { TableColumnHeaderRename } from '@/app/gridGL/HTMLGrid/contextMenus/TableColumnHeaderRename';
import { TableContextMenu } from '@/app/gridGL/HTMLGrid/contextMenus/TableContextMenu';
import { TableRename } from '@/app/gridGL/HTMLGrid/contextMenus/TableRename';
import { TableSort } from '@/app/gridGL/HTMLGrid/contextMenus/tableSort/TableSort';
import { EmptyGridMessage } from '@/app/gridGL/HTMLGrid/EmptyGridMessage';
import { HoverCell } from '@/app/gridGL/HTMLGrid/hoverCell/HoverCell';
import { HoverTooltip } from '@/app/gridGL/HTMLGrid/hoverTooltip/HoverTooltip';
import { HtmlCells } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCells';
import { InlineEditor } from '@/app/gridGL/HTMLGrid/inlineEditor/InlineEditor';
import { MultiplayerCursors } from '@/app/gridGL/HTMLGrid/multiplayerCursor/MultiplayerCursors';
import { MultiplayerCellEdits } from '@/app/gridGL/HTMLGrid/multiplayerInput/MultiplayerCellEdits';
import { SuggestionDropDown } from '@/app/gridGL/HTMLGrid/SuggestionDropdown';
import { useHeadingSize } from '@/app/gridGL/HTMLGrid/useHeadingSize';
import { HtmlValidations } from '@/app/gridGL/HTMLGrid/validations/HtmlValidations';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Following } from '@/app/ui/components/Following';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

interface Props {
  parent?: HTMLDivElement;
}

export interface HtmlGridContainerProps {
  leftHeading: number;
  topHeading: number;
}

export const HTMLGridContainer = (props: Props): ReactNode | null => {
  const { parent } = props;

  const [showInput, setShowInput] = useState(false);
  useEffect(() => {
    const changeInput = (input: boolean) => setShowInput(input);
    events.on('changeInput', changeInput);
    return () => {
      events.off('changeInput', changeInput);
    };
  }, []);

  // this one is not zoomed and positioned over the grid headings
  const [normalContainer, setNormalContainer] = useState<HTMLDivElement>();
  const normalRef = useCallback((node: HTMLDivElement) => {
    if (node) setNormalContainer(node);
  }, []);

  const [zoomContainer, setZoomContainer] = useState<HTMLDivElement>();
  const zoomRef = useCallback((node: HTMLDivElement) => {
    if (node) setZoomContainer(node);
  }, []);

  useEffect(() => {
    if (!zoomContainer || !normalContainer || !parent) return;
    const viewport = pixiApp.viewport;
    const updateTransform = () => {
      viewport.updateTransform();
      let worldTransform = viewport.worldTransform;
      const transform = `matrix(${worldTransform.a}, ${worldTransform.b}, ${worldTransform.c}, ${worldTransform.d}, ${
        worldTransform.tx + parent.offsetLeft
      }, ${worldTransform.ty + parent.offsetTop})`;
      zoomContainer.style.transform = transform;
      normalContainer.style.transform = transform;
    };
    updateTransform();
    events.on('viewportChangedReady', updateTransform);
    window.addEventListener('resize', updateTransform);
    return () => {
      events.off('viewportChangedReady', updateTransform);
      window.removeEventListener('resize', updateTransform);
    };
  }, [normalContainer, parent, zoomContainer]);

  const { leftHeading, topHeading } = useHeadingSize();

  if (!parent) return null;

  if (isNaN(leftHeading) || isNaN(topHeading)) {
    console.log('todo in HTMLGridContainer', { leftHeading, topHeading });
    return null;
  }

  return (
    <>
      {/* This is positioned on the grid inside the headings and zoomed */}
      <div
        style={{
          position: 'absolute',
          left: `${leftHeading}px`,
          top: `${topHeading}px`,
          overflow: 'hidden',
          width: `calc(100% - ${leftHeading}px)`,
          height: `calc(100% - ${topHeading}px)`,
          pointerEvents: 'none',
          textRendering: 'optimizeLegibility',
        }}
      >
        <div style={{ position: 'relative' }}>
          <div
            ref={zoomRef}
            style={{
              position: 'absolute',
              top: `${-topHeading}px`,
              left: `${-leftHeading}px`,
              pointerEvents: 'none',
            }}
          >
            <div style={{ position: 'relative' }}>
              {!showInput && <CodeHint />}
              <MultiplayerCellEdits />
              <InlineEditor />
              <HtmlCells />
              <CodeRunning />
              <HoverCell />
              <HoverTooltip />
              <AskAISelection />
              <MultiplayerCursors topHeading={topHeading} leftHeading={leftHeading} />
              <HtmlValidations />
              <Annotations />
              <SuggestionDropDown />
            </div>
          </div>
        </div>
      </div>

      <Following />

      <EmptyGridMessage />

      {/* This is positioned on the grid over the headings and not zoomed. It comes
          after the above, so it's above it on the grid. */}
      <div
        ref={normalRef}
        style={{
          position: 'absolute',
          pointerEvents: 'none',
        }}
      >
        <GridContextMenu />
        <TableContextMenu />
        <TableColumnContextMenu />
        <TableRename />
        <TableColumnHeaderRename />
        <TableSort />
      </div>
    </>
  );
};
