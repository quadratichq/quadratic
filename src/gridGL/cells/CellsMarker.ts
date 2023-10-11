import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { CodeCellLanguage, JsRenderCodeCellState } from '../../quadratic-core/quadratic_core';
import { colors } from '../../theme/colors';
import { intersects } from '../helpers/intersects';

const triangleSize = 100;
const triangleColor = 'red';

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
    canvas.width = canvas.height = triangleSize;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Expected context to be defined in createTriangle');
    context.fillStyle = triangleColor;
    context.moveTo(0, 0);
    context.lineTo(triangleSize, 0);
    context.lineTo(0, triangleSize);
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
    if (state === JsRenderCodeCellState.RunError || state === 'RunError') {
      error = this.addChild(new Sprite(this.triangle));
      error.alpha = 0.5;
      error.scale.set(0.1);
      error.position.set(x, y);
    }

    const child = this.addChild(new Sprite());
    child.height = 4;
    child.width = 4;
    child.position.set(x + 1.25, y + 1.25);
    if (type === CodeCellLanguage.Python || type === 'Python') {
      child.texture = Texture.from('/images/python-icon.png');
      child.tint = error ? 0xffffff : colors.cellColorUserPython;
    } else if (type === CodeCellLanguage.Formula || type === 'Formula') {
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
