import { JsRenderCodeCell } from '@/quadratic-core/types';
import { Container, Point, Rectangle, Sprite, Texture } from 'pixi.js';
import { colors } from '../../theme/colors';
import { intersects } from '../helpers/intersects';

const TRIANGLE_SIZE = 100;
const INDICATOR_SIZE = 4;

export type CellsMarkerTypes = 'CodeIcon' | 'FormulaIcon' | 'AIIcon' | 'ErrorIcon';

interface Marker {
  sprite: Sprite;
  bounds: Rectangle;
  rectangle: Rectangle;
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

  cheapCull(bounds: Rectangle): void {
    this.markers.forEach((marker) => (marker.sprite.visible = intersects.rectangleRectangle(bounds, marker.rectangle)));
  }

  addTriangle(box: Rectangle, codeCell: JsRenderCodeCell): Sprite | undefined {
    const triangle = this.addChild(new Sprite(this.triangle));
    triangle.scale.set(0.1);
    triangle.position.set(box.x, box.y);
    if (codeCell.state === 'RunError' || codeCell.state === 'SpillError') {
      triangle.tint = colors.cellColorError;
    } else if (codeCell.language === 'Python') {
      triangle.tint = colors.cellColorUserPython;
    } else if (codeCell.language === 'Formula') {
      triangle.tint = colors.cellColorUserFormula;
    }
    return triangle;
  }

  add(box: Rectangle, codeCell: JsRenderCodeCell, selected: boolean) {
    const error = this.addTriangle(box, codeCell);

    if (error || selected) {
      const child = this.addChild(new Sprite());
      child.height = INDICATOR_SIZE;
      child.width = INDICATOR_SIZE;
      child.position.set(box.x + 1.25, box.y + 1.25);
      if (codeCell.language === 'Python') {
        child.texture = Texture.from('/images/python-icon.png');
        child.tint = error ? 0xffffff : colors.cellColorUserPython;
      } else if (codeCell.language === 'Formula') {
        child.texture = Texture.from('/images/formula-fx-icon.png');
        child.tint = error ? 0xffffff : colors.cellColorUserFormula;
      }

      this.markers.push({
        sprite: child,
        bounds: new Rectangle(box.x, box.y, box.width, box.height),
        rectangle: new Rectangle(child.x, child.y, 4, 4),
        codeCell,
      });
    }
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
