import * as PIXI from 'pixi.js';

export function rectanglePoint(rectangle: PIXI.Rectangle, point: PIXI.Point): boolean {
    return point.x >= rectangle.left && point.x <= rectangle.right && point.y >= rectangle.top && point.y <= rectangle.bottom;
}