import { JsRenderCodeCell } from '@/quadratic-core/types';
import { Container, Point, Rectangle, Sprite, Texture } from 'pixi.js';
import { colors } from '../../theme/colors';
import { intersects } from '../helpers/intersects';
import { Coordinate } from '../types/size';

const TRIANGLE_SIZE = 100;
const TRIANGLE_COLOR = 'red';
const INDICATOR_SIZE = 4;

export type CellsMarkerTypes = 'CodeIcon' | 'FormulaIcon' | 'AIIcon' | 'ErrorIcon';

interface Marker {
  sprite: Sprite;
  rectangle: Rectangle;
}

export class CellsMarkers extends Container {
  private markers: Marker[] = [];
  private triangle: Texture;

  constructor() {
    super(); //, { vertices: true, tint: true });
    this.triangle = this.createTriangle();
  }

  private createTriangle(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TRIANGLE_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Expected context to be defined in createTriangle');
    context.fillStyle = TRIANGLE_COLOR;
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

  addTriangle(x: number, y: number, codeCell: JsRenderCodeCell): Sprite | undefined {
    if (codeCell.state === 'RunError' || codeCell.state === 'SpillError') {
      const error = this.addChild(new Sprite(this.triangle));
      error.alpha = 0.5;
      error.scale.set(0.1);
      error.position.set(x, y);
      return error;
    }
  }

  add(x: number, y: number, codeCell: JsRenderCodeCell) {
    const error = this.addTriangle(x, y, codeCell);

    const child = this.addChild(new Sprite());
    child.height = INDICATOR_SIZE;
    child.width = INDICATOR_SIZE;
    child.position.set(x + 1.25, y + 1.25);
    if (codeCell.language === 'Python') {
      child.texture = Texture.from('/images/python-icon.png');
      child.tint = error ? 0xffffff : colors.cellColorUserPython;
    } else if (codeCell.language === 'Formula') {
      child.texture = Texture.from('/images/formula-fx-icon.png');
      child.tint = error ? 0xffffff : colors.cellColorUserFormula;
    }

    this.markers.push({
      sprite: child,
      rectangle: new Rectangle(child.x, child.y, 4, 4),
    });
  }

  intersectsMarker(point: Point): Coordinate | undefined {
    const marker = this.markers.find((marker) => marker.rectangle.contains(point.x, point.y));
    if (marker) {
      return { x: marker.rectangle.x, y: marker.rectangle.y };
    }
  }

  debugShowCachedCounts(): void {
    console.log(
      `[CellsMarker] ${this.children.length} objects | ${this.children.filter((child) => child.visible).length} visible`
    );
  }
}
