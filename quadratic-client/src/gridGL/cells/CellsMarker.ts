import { CodeCellLanguage, JsRenderCodeCellState } from '@/quadratic-core/types';
import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { colors } from '../../theme/colors';
import { intersects } from '../helpers/intersects';

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

  add(x: number, y: number, type: CodeCellLanguage | string, state?: JsRenderCodeCellState | string): void {
    let error: Sprite | undefined;
    if (state === 'RunError' || state === 'SpillError') {
      error = this.addChild(new Sprite(this.triangle));
      error.alpha = 0.5;
      error.scale.set(0.1);
      error.position.set(x, y);
    }

    const child = this.addChild(new Sprite());
    child.height = INDICATOR_SIZE;
    child.width = INDICATOR_SIZE;
    child.position.set(x + 1.25, y + 1.25);
    if (type === 'Python') {
      child.texture = Texture.from('/images/python-icon.png');
      child.tint = error ? 0xffffff : colors.cellColorUserPython;
    } else if (type === 'Formula') {
      child.texture = Texture.from('/images/formula-fx-icon.png');
      child.tint = error ? 0xffffff : colors.cellColorUserFormula;
    }

    this.markers.push({
      sprite: child,
      rectangle: new Rectangle(child.x, child.y, 4, 4),
    });
  }

  debugShowCachedCounts(): void {
    console.log(
      `[CellsMarker] ${this.children.length} objects | ${this.children.filter((child) => child.visible).length} visible`
    );
  }
}
