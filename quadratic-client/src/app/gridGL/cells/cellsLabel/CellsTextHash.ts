/**
 * CellsTextHash is the parent container for the text of cells in a hashed
 * region of the sheet.
 *
 * It contains LabelMeshes children. LabelMeshes are rendered meshes for each
 * font and style combination. LabelMeshes are populated using the data within
 * each CellLabel within the hashed region. LabelMeshes may contain multiple
 * LabelMesh children of the same font/style combination to ensure that the
 * webGL buffers do not exceed the maximum size.
 *
 * The data calculations occur in renderWebWorker::CellsTextHash.ts.
 */

import { Bounds } from '@/app/grid/sheet/Bounds';
import { CellsCodeOutlines } from '@/app/gridGL/cells/cellsLabel/CellsCodeOutlines';
import { CellsDrawRects } from '@/app/gridGL/cells/cellsLabel/CellsDrawRects';
import { CellsTextHashSpecial } from '@/app/gridGL/cells/cellsLabel/CellsTextHashSpecial';
import { CellsTextHashValidations } from '@/app/gridGL/cells/cellsLabel/CellsTextHashValidations';
import { LabelMeshEntry } from '@/app/gridGL/cells/cellsLabel/LabelMeshEntry';
import type { ErrorMarker, ErrorValidation } from '@/app/gridGL/cells/CellsSheet';
import { sheetHashHeight, sheetHashWidth } from '@/app/gridGL/cells/CellsTypes';
import { intersects } from '@/app/gridGL/helpers/intersects';
import type { Link } from '@/app/shared/types/links';
import type { DrawRects } from '@/app/shared/types/size';
import type { RenderClientLabelMeshEntry } from '@/app/web-workers/renderWebWorker/renderClientMessages';
import type { RenderSpecial } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsTextHashSpecial';
import type { Graphics, Point, Renderer, Sprite } from 'pixi.js';
import { BitmapText, Container, Rectangle } from 'pixi.js';

// Draw hashed regions of cell glyphs (the text + text formatting)
export class CellsTextHash extends Container {
  // holds replacement LabelMeshEntry objects that will replace the current children once we receive them all
  private newChildren: LabelMeshEntry[] = [];

  // draws the text
  private entries: Container<LabelMeshEntry>;

  // holds emojis
  private emojis: Container<Sprite>;

  // draws special text (ie, checkboxes and dropdown list indicator)
  special: CellsTextHashSpecial;

  warnings: CellsTextHashValidations;

  sheetId: string;

  hashX: number;
  hashY: number;

  // column/row bounds (does not include overflow cells)
  AABB: Rectangle;

  // received from render web worker and used for culling
  bounds: Bounds;
  textBounds: Rectangle;

  // color to use for drawDebugBox
  debugColor = Math.floor(Math.random() * 0xffffff);

  links: Link[];

  newDrawRects: DrawRects[];
  drawRects: CellsDrawRects;

  newCodeOutlines: { x: number; y: number; width: number; height: number }[];
  codeOutlines: CellsCodeOutlines;

  constructor(sheetId: string, hashX: number, hashY: number, viewRectangle?: Rectangle) {
    super();
    this.sheetId = sheetId;
    this.AABB = new Rectangle(hashX * sheetHashWidth, hashY * sheetHashHeight, sheetHashWidth - 1, sheetHashHeight - 1);
    this.textBounds = viewRectangle || this.AABB;
    this.hashX = hashX;
    this.hashY = hashY;

    this.entries = this.addChild(new Container<LabelMeshEntry>());
    this.emojis = this.addChild(new Container<Sprite>());
    this.special = this.addChild(new CellsTextHashSpecial());
    this.warnings = this.addChild(new CellsTextHashValidations(this, sheetId));

    this.links = [];

    this.newDrawRects = [];
    this.drawRects = this.addChild(new CellsDrawRects());

    this.newCodeOutlines = [];
    this.codeOutlines = this.addChild(new CellsCodeOutlines());

    // we track the bounds of both the text and validations
    this.bounds = new Bounds();
    this.updateHashBounds();
  }

  clear() {
    this.entries.removeChildren();
    this.special.clear();
    this.drawRects.clear();
    this.codeOutlines.clear();
  }

  addLabelMeshEntry(message: RenderClientLabelMeshEntry) {
    // we handle emojis separately (triggered by a 0 textureUid)
    if (message.textureUid !== 0) {
      this.newChildren.push(new LabelMeshEntry(message));
    }
  }

  finalizeLabelMeshEntries(special?: RenderSpecial) {
    this.entries.removeChildren();
    this.newChildren.forEach((child) => this.entries.addChild(child));
    this.newChildren = [];
    this.special.update(special);
    this.drawRects.update(this.newDrawRects);
    this.newDrawRects = [];
    this.codeOutlines.update(this.newCodeOutlines);
    this.newCodeOutlines = [];
  }

  updateHashBounds() {
    this.bounds.clear();
    this.bounds.addRectangle(this.textBounds);
    this.bounds.mergeInto(this.warnings.bounds);
  }

  clearMeshEntries(viewRectangle: Rectangle) {
    this.textBounds = viewRectangle;
    this.x = 0;
    this.y = 0;
    this.updateHashBounds();
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  // overrides container's render function
  render(renderer: Renderer) {
    if (this.visible && this.worldAlpha > 0 && this.renderable) {
      const { a, b, c, d } = this.transform.worldTransform;
      const dx = Math.sqrt(a * a + b * b);
      const dy = Math.sqrt(c * c + d * d);
      const worldScale = (Math.abs(dx) + Math.abs(dy)) / 2;
      const resolution = renderer.resolution;
      const scale = worldScale * resolution;
      this.entries.children.forEach((child) => child.setUniforms(scale));
      super.render(renderer);
    }
  }

  drawDebugBox(g: Graphics, c: Container) {
    const screen = this.textBounds;
    g.beginFill(this.debugColor, 0.25);
    g.drawShape(screen);
    g.endFill();
    const text = c.addChild(new BitmapText(`${this.hashX},${this.hashY}`, { fontName: 'OpenSans', fontSize: 12 }));
    text.tint = 0xff0000;
    text.position.set(screen.x, screen.y);
  }

  adjust(hashX: number | undefined, hashY: number | undefined, delta: number) {
    if (hashX !== undefined) {
      if (hashX < 0 && this.hashX < hashX) {
        this.x -= delta;
        this.textBounds.x -= delta;
      } else if (hashX >= 0 && this.hashX > hashX) {
        this.x += delta;
        this.textBounds.x += delta;
      }
    }
    if (hashY !== undefined) {
      if (hashY < 0 && this.hashY < hashY) {
        this.y -= delta;
        this.textBounds.y -= delta;
      } else if (hashY >= 0 && this.hashY > hashY) {
        this.y += delta;
        this.textBounds.y += delta;
      }
    }
    this.updateHashBounds();
    this.warnings.reposition();
  }

  getErrorMarker(x: number, y: number): ErrorMarker | undefined {
    return this.warnings.getErrorMarker(x, y);
  }

  intersectsErrorMarkerValidation(world: Point): ErrorValidation | undefined {
    return this.warnings.intersectsErrorMarkerValidation(world);
  }

  intersectsLink = (world: Point): Link | undefined => {
    for (const link of this.links) {
      const textRectangle = new Rectangle(
        link.textRectangle.x + this.x,
        link.textRectangle.y + this.y,
        link.textRectangle.width,
        link.textRectangle.height
      );
      const isLink = intersects.rectanglePoint(textRectangle, world);
      if (isLink)
        return {
          pos: link.pos,
          textRectangle,
          url: link.url,
          linkText: link.linkText,
          isNakedUrl: link.isNakedUrl,
          spanStart: link.spanStart,
          spanEnd: link.spanEnd,
        };
    }
    return undefined;
  };
}
