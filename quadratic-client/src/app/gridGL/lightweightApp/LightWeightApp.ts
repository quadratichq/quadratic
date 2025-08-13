import { sheets } from '@/app/grid/controller/Sheets';
import { BaseApp } from '@/app/gridGL/BaseApp';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { WHEEL_ZOOM_PERCENT } from '@/app/gridGL/pixiApp/viewport/Viewport';
import { HORIZONTAL_SCROLL_KEY, Wheel, ZOOM_KEY } from '@/app/gridGL/pixiApp/viewport/Wheel';

export class LightWeightApp extends BaseApp {
  private parent: HTMLElement;

  constructor(parent: HTMLElement) {
    super();
    this.parent = parent;
    this.parent.appendChild(this.canvas);

    this.viewport.drag().pinch();
    this.viewport.plugins.add(
      'wheel',
      new Wheel(this.viewport, {
        trackpadPinch: true,
        wheelZoom: true,
        percent: WHEEL_ZOOM_PERCENT,
        keyToPress: [...ZOOM_KEY, ...HORIZONTAL_SCROLL_KEY],
      })
    );

    this.viewport.addChild(this.gridLines);

    this.resize();
    this.update();
  }

  reposition(columnStart: number, rowStart: number, columnEnd: number, rowEnd: number) {
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
    this.viewport.clampZoom({
      maxWidth: end.x + end.width - start.x,
      maxHeight: end.y + end.height - start.y,
    });
  }

  destroy() {
    super.destroy();
    // this.renderer.destroy(true);
  }

  resize() {
    if (!this.parent || this.destroyed) return;
    const width = this.parent.offsetWidth;
    const height = this.parent.offsetHeight;
    this.canvas.width = this.renderer.resolution * width;
    this.canvas.height = this.renderer.resolution * height;
    this.renderer.resize(width, height);
    this.viewport.resize(width, height);
    this.gridLines.dirty = true;
    // this.headings.dirty = true;
    // this.cursor.dirty = true;
    // this.cellHighlights.setDirty();
    this.render();
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
    if (this.viewport.dirty) {
      this.render();
      this.viewport.dirty = false;
    }
    requestAnimationFrame(this.update);
  };
}
