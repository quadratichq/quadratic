import { ReactNode, useCallback, useEffect, useState } from 'react';
import { pixiApp } from '../pixiApp/PixiApp';

interface Props {
  parent?: HTMLDivElement;
  children?: ReactNode[] | ReactNode;
}

export const HTMLGridContainer = (props: Props): ReactNode | null => {
  const { parent, children } = props;

  const [container, setContainer] = useState<HTMLDivElement>();
  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) setContainer(node);
  }, []);

  useEffect(() => {
    if (!container || !parent) return;
    const viewport = pixiApp.viewport;
    const updateTransform = () => {
      let worldTransform = viewport.worldTransform;
      container.style.transform = `matrix(${worldTransform.a}, ${worldTransform.b}, ${worldTransform.c}, ${
        worldTransform.d
      }, ${worldTransform.tx + parent.offsetLeft}, ${worldTransform.ty + parent.offsetTop})`;
    };
    updateTransform();
    viewport.on('moved', updateTransform);
    viewport.on('moved-end', updateTransform);
    viewport.on('zoomed', updateTransform);
    return () => {
      viewport.off('moved', updateTransform);
      viewport.off('moved-end', updateTransform);
      viewport.off('zoomed', updateTransform);
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
          <div style={{ position: 'relative' }}>{children}</div>
        </div>
      </div>
    </div>
  );
};
