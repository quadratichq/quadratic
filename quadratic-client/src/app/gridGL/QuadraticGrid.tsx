import { gridPanModeAtom } from '@/app/atoms/gridPanModeAtom';
import { HTMLGridContainer } from '@/app/gridGL/HTMLGrid/HTMLGridContainer';
import { useKeyboard } from '@/app/gridGL/interaction/keyboard/useKeyboard';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { ImportProgress } from '@/app/ui/components/ImportProgress';
import { Search } from '@/app/ui/components/Search';
import { MouseEvent, useCallback, useState } from 'react';
import { useRecoilCallback } from 'recoil';

export default function QuadraticGrid() {
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
        set(gridPanModeAtom, (prev) => ({ ...prev, mouseIsDown: e.buttons === 1 && e.button === 0 }));
      },
    []
  );
  const disablePanMode = useRecoilCallback(
    ({ set }) =>
      () => {
        set(gridPanModeAtom, (prev) => ({ ...prev, mouseIsDown: false, spaceIsDown: false }));
      },
    []
  );

  const { onKeyDown, onKeyUp } = useKeyboard();

  return (
    <div
      ref={containerRef}
      className="dark-mode-hack"
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
      <ImportProgress />
      <Search />
    </div>
  );
}
