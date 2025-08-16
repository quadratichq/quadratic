import { sheets } from '@/app/grid/controller/Sheets';
import { BaseApp } from '@/app/gridGL/BaseApp';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Drag } from '@/app/gridGL/pixiApp/viewport/Drag';
import { WHEEL_ZOOM_PERCENT } from '@/app/gridGL/pixiApp/viewport/Viewport';
import { HORIZONTAL_SCROLL_KEY, Wheel, ZOOM_KEY } from '@/app/gridGL/pixiApp/viewport/Wheel';
import { isMobile } from 'react-device-detect';

export class LightWeightApp extends BaseApp {
  private parent: HTMLElement;

  constructor(parent: HTMLElement) {
    super();
    this.parent = parent;
    this.parent.appendChild(this.canvas);

    // don't allow wheel event to bubble up to the parent (since this is
    // embedded on a scrollable page)
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
      },
      { passive: false }
    );

    this.viewport.plugins.add(
      'drag',
      new Drag(this.viewport, {
        pressDrag: true,
        wheel: false, // handled by Wheel plugin below
        keyToPress: isMobile ? undefined : ['Space'],
      })
    );
    this.viewport.pinch();
    this.viewport.plugins.add(
      'wheel',
      new Wheel(
        this.viewport,
        {
          trackpadPinch: true,
          wheelZoom: true,
          percent: WHEEL_ZOOM_PERCENT,
          keyToPress: [...ZOOM_KEY, ...HORIZONTAL_SCROLL_KEY],
        },
        this.canvas
      )
    );

    this.viewport.addChild(this.gridLines);

    this.resize();
    this.update();
  }

  reposition(
    columnStart: number,
    rowStart: number,
    columnEnd: number,
    rowEnd: number
  ): { width: number; height: number } {
    const start = sheets.sheet.getCellOffsets(columnStart, rowStart);
    const end = sheets.sheet.getCellOffsets(columnEnd, rowEnd);
    this.viewport.position.set(-start.x, -start.y);
    this.viewport.clamp({
      left: start.x,
      top: start.y,
      right: end.x + end.width,
      bottom: end.y + end.height,
      underflow: 'top-left',
    });
    const maxWidth = end.x + end.width - start.x;
    const maxHeight = end.y + end.height - start.y;
    this.viewport.clampZoom({
      maxWidth,
      maxHeight,
    });
    return { width: maxWidth, height: maxHeight };
  }

  render() {
    const cellSheet = pixiApp.cellsSheet();
    const oldParent = cellSheet.parent;

    this.viewport.addChild(cellSheet);

    this.gridLines.update(this.viewport.getVisibleBounds(), this.viewport.scale.x, true);
    this.renderer.render(this.viewport);

    oldParent.addChild(cellSheet);
  }

  update = () => {
    if (this.destroyed) return;
    if (this.viewport.dirty) {
      this.render();
      this.viewport.dirty = false;
    }
    requestAnimationFrame(this.update);
  };
}
