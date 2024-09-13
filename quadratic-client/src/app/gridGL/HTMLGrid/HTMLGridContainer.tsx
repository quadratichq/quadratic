import { events } from '@/app/events/events';
import { InlineEditor } from '@/app/gridGL/HTMLGrid/inlineEditor/InlineEditor';
import { MultiplayerCursors } from '@/app/gridGL/HTMLGrid/multiplayerCursor/MulitplayerCursors';
import { useHeadingSize } from '@/app/gridGL/HTMLGrid/useHeadingSize';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { pixiApp } from '../pixiApp/PixiApp';
import { CodeHint } from './CodeHint';
import { CodeRunning } from './codeRunning/CodeRunning';
import { GridContextMenu } from './GridContextMenu';
import { HoverCell } from './hoverCell/HoverCell';
import { HtmlCells } from './htmlCells/HtmlCells';
import { MultiplayerCellEdits } from './multiplayerInput/MultiplayerCellEdits';
import { HtmlValidations } from './validations/HtmlValidations';

interface Props {
  parent?: HTMLDivElement;
}

export interface HtmlGridContainerProps {
  leftHeading: number;
  topHeading: number;
}

export const HTMLGridContainer = (props: Props): ReactNode | null => {
  const { parent } = props;

  const [container, setContainer] = useState<HTMLDivElement>();
  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) setContainer(node);
  }, []);

  const [showInput, setShowInput] = useState(false);
  useEffect(() => {
    const changeInput = (input: boolean) => setShowInput(input);
    events.on('changeInput', changeInput);
    return () => {
      events.off('changeInput', changeInput);
    };
  }, []);

  useEffect(() => {
    if (!container || !parent) return;
    const viewport = pixiApp.viewport;
    const updateTransform = () => {
      viewport.updateTransform();
      let worldTransform = viewport.worldTransform;
      container.style.transform = `matrix(${worldTransform.a}, ${worldTransform.b}, ${worldTransform.c}, ${
        worldTransform.d
      }, ${worldTransform.tx + parent.offsetLeft}, ${worldTransform.ty + parent.offsetTop})`;
    };
    updateTransform();
    viewport.on('moved', updateTransform);
    viewport.on('moved-end', updateTransform);
    viewport.on('zoomed', updateTransform);
    window.addEventListener('resize', updateTransform);
    return () => {
      viewport.off('moved', updateTransform);
      viewport.off('moved-end', updateTransform);
      viewport.off('zoomed', updateTransform);
      window.removeEventListener('resize', updateTransform);
    };
  }, [parent, container]);

  const { leftHeading, topHeading } = useHeadingSize();

  if (!parent) return null;

  return (
    <>
      <GridContextMenu />
      <div
        style={{
          position: 'absolute',
          left: `${leftHeading}px`,
          top: `${topHeading}px`,
          overflow: 'hidden',
          width: `calc(100% - ${leftHeading}px)`,
          height: `calc(100% - ${topHeading}px)`,
          pointerEvents: 'none',
        }}
      >
        <div style={{ position: 'relative' }}>
          <div
            ref={containerRef}
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
              <MultiplayerCursors topHeading={topHeading} leftHeading={leftHeading} />
              <HtmlValidations />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
