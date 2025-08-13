import { sheets } from '@/app/grid/controller/Sheets';
import { BaseApp } from '@/app/gridGL/BaseApp';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Viewport, WHEEL_ZOOM_PERCENT } from '@/app/gridGL/pixiApp/viewport/Viewport';
import { HORIZONTAL_SCROLL_KEY, Wheel, ZOOM_KEY } from '@/app/gridGL/pixiApp/viewport/Wheel';

export class LightWeightApp extends BaseApp {
  private parent: HTMLElement;

  constructor(parent: HTMLElement) {
    super();
    this.parent = parent;
    this.parent.appendChild(this.canvas);

    this.viewport = new Viewport(this);
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

  reposition(column: number, row: number) {
    const position = sheets.sheet.getCellOffsets(column, row);
    this.viewport.position.set(-position.x, -position.y);
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
