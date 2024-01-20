import { CELL_HEIGHT } from '@/constants/gridConstants';
import { JsRenderCodeCell } from '@/quadratic-core/types';
import { Container, Point, Rectangle, Sprite, Texture } from 'pixi.js';
import { colors } from '../../theme/colors';

const TRIANGLE_SIZE = 100;
const INDICATOR_SIZE = 4;
const CODE_OFFSET = { x: 1, y: 1, width: 2 };
export type CellsMarkerTypes = 'CodeIcon' | 'FormulaIcon' | 'AIIcon' | 'ErrorIcon';

interface Marker {
  bounds: Rectangle;
  codeCell: JsRenderCodeCell;
}

export class CellsMarkers extends Container {
  private markers: Marker[] = [];
  private triangle: Texture;

  constructor() {
    super();
    this.triangle = this.createTriangle();
  }

  private createTriangle(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TRIANGLE_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Expected context to be defined in createTriangle');
    context.fillStyle = 'white';
    context.moveTo(0, 0);
    context.lineTo(TRIANGLE_SIZE, 0);
    context.lineTo(0, TRIANGLE_SIZE);
    context.closePath();
    context.fill();
    return Texture.from(canvas);
  }

  clear() {
    this.removeChildren();
    this.markers = [];
  }

  add(box: Rectangle, codeCell: JsRenderCodeCell, selected: boolean) {
    const isError = codeCell.state === 'RunError' || codeCell.state === 'SpillError';
    if (isError) {
      const sprite = this.addChild(new Sprite(this.triangle));
      sprite.scale.set(0.1);
      sprite.position.set(box.x, box.y);
      sprite.tint = colors.cellColorError;
    } else {
      const sprite = this.addChild(new Sprite(Texture.WHITE));
      sprite.position.set(box.x + CODE_OFFSET.x, box.y + CODE_OFFSET.y);
      sprite.height = Math.min(box.height - CODE_OFFSET.y * 2, CELL_HEIGHT - CODE_OFFSET.y * 2);
      sprite.width = CODE_OFFSET.width;
      if (codeCell.language === 'Python') {
        sprite.tint = colors.cellColorUserPython;
      } else if (codeCell.language === 'Formula') {
        sprite.tint = colors.cellColorUserFormula;
      }
    }

    if (isError || selected) {
      const child = this.addChild(new Sprite());
      child.height = INDICATOR_SIZE;
      child.width = INDICATOR_SIZE;
      child.position.set(box.x + 1.25, box.y + 1.25);
      if (codeCell.language === 'Python') {
        child.texture = Texture.from('/images/python-icon.png');
        child.tint = isError ? 0xffffff : colors.cellColorUserPython;
      } else if (codeCell.language === 'Formula') {
        child.texture = Texture.from('/images/formula-fx-icon.png');
        child.tint = isError ? 0xffffff : colors.cellColorUserFormula;
      }
    }
    this.markers.push({
      bounds: new Rectangle(box.x, box.y, box.width, box.height),
      codeCell,
    });
  }

  intersectsCodeError(point: Point): JsRenderCodeCell | undefined {
    const marker = this.markers.find((marker) => marker.bounds.contains(point.x, point.y));
    if (marker?.codeCell) {
      return marker.codeCell;
    }
  }

  debugShowCachedCounts(): void {
    console.log(
      `[CellsMarker] ${this.children.length} objects | ${this.children.filter((child) => child.visible).length} visible`
    );
  }
}
