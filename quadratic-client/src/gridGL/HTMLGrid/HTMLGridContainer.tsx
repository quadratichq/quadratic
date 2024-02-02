import { MultiplayerCursors } from '@/gridGL/HTMLGrid/multiplayerCursor/MulitplayerCursors';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { pixiApp } from '../pixiApp/PixiApp';
import { CellInput } from './CellInput';
import { CodeRunning } from './codeRunning/CodeRunning';
import { HoverCell } from './hoverCell/HoverCell';
import { HtmlCells } from './htmlCells/HtmlCells';
import { MultiplayerCellEdits } from './multiplayerInput/MultiplayerCellEdits';

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
    const changeInput = (e: any) => setShowInput(e.detail.showInput);
    window.addEventListener('change-input', changeInput);
    return () => window.removeEventListener('change-input', changeInput);
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

  const [topHeading, setTopHeading] = useState(0);
  const [leftHeading, setLeftHeading] = useState(0);
  useEffect(() => {
    const updateHeadingSize = (e: any) => {
      setTopHeading(e.detail.height);
      setLeftHeading(e.detail.width);
    };
    window.addEventListener('heading-size', updateHeadingSize);
    return () => window.removeEventListener('heading-size', updateHeadingSize);
  }, []);

  if (!parent) return null;

  return (
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
            {showInput && <CellInput />}
            <MultiplayerCellEdits />
            <HtmlCells />
            <CodeRunning />
            <HoverCell />
            <MultiplayerCursors topHeading={topHeading} leftHeading={leftHeading} />
          </div>
        </div>
      </div>
    </div>
  );
};
