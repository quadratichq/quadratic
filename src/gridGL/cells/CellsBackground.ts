import Color from 'color';
import { Container, Sprite, Texture } from 'pixi.js';
import { Coordinate } from '../types/size';
import { CellFormat } from '../../grid/sheet/gridTypes';
import { QuadrantsSort } from './QuadrantsSort';

interface CellBackgroundSprite extends Sprite {
  location: Coordinate;
  lastFillColor: string;
}

export class CellsBackground extends Container {
  private background = new Map<string, CellBackgroundSprite>();
  private quadrants = new QuadrantsSort<CellBackgroundSprite>();
  private cache: CellBackgroundSprite[] = [];

  empty(): void {
    this.background.forEach(entry => this.cache.push(entry));
    this.background.clear();
    this.quadrants.empty();
  }

  private clear(): void {
    this.children.forEach((child) => (child.visible = false));
  }

  add(options: {
    location: Coordinate;
    x: number;
    y: number;
    width: number;
    height: number;
    format?: CellFormat;
  }): void {
    const { location, x, y, width, height, format } = options;
    let sprite = this.background.get(`${location.x},${location.y}`);
    if (sprite) {

      // if there is no longer a fill color then save the sprite for reuse
      if (!format?.fillColor) {
        this.cache.push(sprite);
        this.removeChild(sprite);
        this.quadrants.remove(location);
        return;
      }

    } else {

      // no need to create a background if the cell has no format
      if (!format?.fillColor) return;

      if (this.cache.length) {
        sprite = this.cache.pop() as CellBackgroundSprite;
      } else {
        sprite = this.addChild(new Sprite(Texture.WHITE)) as CellBackgroundSprite;
      }
      sprite.location = location;
      this.quadrants.add(location, sprite);
    }

    sprite.visible = true;

    // don't parse if the same value
    if (sprite.lastFillColor !== format.fillColor) {
      sprite.tint = Color(format.fillColor).rgbNumber();
    }
    sprite.lastFillColor = format.fillColor;

    sprite.width = width;
    sprite.height = height;
    sprite.position.set(x, y);
  }
}
