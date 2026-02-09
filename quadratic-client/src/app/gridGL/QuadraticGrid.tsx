import { gridPanModeAtom } from '@/app/atoms/gridPanModeAtom';
import { HTMLGridContainer } from '@/app/gridGL/HTMLGrid/HTMLGridContainer';
import { ScrollBars } from '@/app/gridGL/HTMLGrid/scrollBars/ScrollBars';
import { useKeyboard } from '@/app/gridGL/interaction/keyboard/useKeyboard';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { ImportProgress } from '@/app/ui/components/ImportProgress';
import { Search } from '@/app/ui/components/Search';
import type { MouseEvent } from 'react';
import { memo, useCallback, useState } from 'react';
import { useRecoilCallback } from 'recoil';

export const QuadraticGrid = memo(() => {
  const [container, setContainer] = useState<HTMLDivElement>();
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setContainer(node);
      pixiApp.attach(node);
    }
  }, []);

  const handleMouseChange = useRecoilCallback(
    ({ set }) =>
      (e: MouseEvent) => {
        set(gridPanModeAtom, (prev) => {
          const mouseIsDown = e.buttons === 1 && e.button === 0;

          if (prev && mouseIsDown === prev.mouseIsDown) {
            return prev;
          }

          return { ...prev, mouseIsDown };
        });
      },
    []
  );
  const disablePanMode = useRecoilCallback(
    ({ set }) =>
      () => {
        set(gridPanModeAtom, (prev) => {
          if (prev && prev.mouseIsDown === false && prev.spaceIsDown === false) {
            return prev;
          }

          return { ...prev, mouseIsDown: false, spaceIsDown: false };
        });
      },
    []
  );

  const { onKeyDown, onKeyUp } = useKeyboard();

  return (
    <div
      className="pointer-up-ignore"
      ref={containerRef}
      data-walkthrough="grid-canvas"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        outline: 'none',
        overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent',
      }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={handleMouseChange}
      onMouseUp={handleMouseChange}
      onMouseMove={handleMouseChange}
      onBlur={disablePanMode}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
    >
      <HTMLGridContainer parent={container} />
      <ScrollBars />
      <Search />
      <ImportProgress />
    </div>
  );
});
