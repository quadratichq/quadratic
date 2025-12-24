import { events } from '@/app/events/events';
import { Annotations } from '@/app/gridGL/HTMLGrid/annotations/Annotations';
import { CodeHint } from '@/app/gridGL/HTMLGrid/CodeHint';
import { CodeRunning } from '@/app/gridGL/HTMLGrid/codeRunning/CodeRunning';
import { GridContextMenu } from '@/app/gridGL/HTMLGrid/contextMenus/GridContextMenu';
import { TableColumnHeaderRename } from '@/app/gridGL/HTMLGrid/contextMenus/TableColumnHeaderRename';
import { TableRename } from '@/app/gridGL/HTMLGrid/contextMenus/TableRename';
import { TableSort } from '@/app/gridGL/HTMLGrid/contextMenus/tableSort/TableSort';
import { EmojiDropdown } from '@/app/gridGL/HTMLGrid/EmojiDropdown';
import { GridFileInput } from '@/app/gridGL/HTMLGrid/GridFileInput';
import { HoverCell } from '@/app/gridGL/HTMLGrid/hoverCell/HoverCell';
import { HoverTooltip } from '@/app/gridGL/HTMLGrid/hoverTooltip/HoverTooltip';
import { HyperlinkPopup } from '@/app/gridGL/HTMLGrid/linkPopup/HyperlinkPopup';
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
import { useEffect, useRef } from 'react';

interface Props {
  parent?: HTMLDivElement;
}

export interface HtmlGridContainerProps {
  leftHeading: number;
  topHeading: number;
}

export const HTMLGridContainer = (props: Props): ReactNode | null => {
  const { parent } = props;

  // this one is not zoomed and positioned over the grid headings
  const normalRef = useRef<HTMLDivElement>(null);

  const zoomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateTransform = () => {
      if (!zoomRef.current || !normalRef.current || !parent) return;

      pixiApp.viewport.updateTransform();
      let worldTransform = pixiApp.viewport.worldTransform;
      const transform = `matrix(${worldTransform.a}, ${worldTransform.b}, ${worldTransform.c}, ${worldTransform.d}, ${
        worldTransform.tx + parent.offsetLeft
      }, ${worldTransform.ty + parent.offsetTop})`;
      zoomRef.current.style.transform = transform;
      normalRef.current.style.transform = transform;
    };
    updateTransform();
    events.on('viewportChangedReady', updateTransform);
    window.addEventListener('resize', updateTransform);
    return () => {
      events.off('viewportChangedReady', updateTransform);
      window.removeEventListener('resize', updateTransform);
    };
  }, [parent]);

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
          zIndex: 1,
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
              <CodeHint />
              <MultiplayerCellEdits />
              <InlineEditor />
              <HtmlCells />
              <CodeRunning />
              <HoverCell />
              <HoverTooltip />
              <HyperlinkPopup />
              <MultiplayerCursors topHeading={topHeading} leftHeading={leftHeading} />
              <HtmlValidations />
              <Annotations />
              <SuggestionDropDown />
              <EmojiDropdown />
            </div>
          </div>
        </div>
      </div>

      <GridFileInput />
      <Following />

      {/* This is positioned on the grid over the headings and not zoomed. It comes
          after the above, so it's above it on the grid. */}
      <div
        ref={normalRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      >
        <GridContextMenu />
        <TableRename />
        <TableColumnHeaderRename />
        <TableSort />
      </div>
    </>
  );
};
