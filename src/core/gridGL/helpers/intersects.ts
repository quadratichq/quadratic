import * as PIXI from 'pixi.js';

function rectanglePoint(rectangle: PIXI.Rectangle, point: PIXI.Point): boolean {
  return (
    point.x >= rectangle.left && point.x <= rectangle.right && point.y >= rectangle.top && point.y <= rectangle.bottom
  );
}

function rectangleRectangle(rectangle1: PIXI.Rectangle, rectangle2: PIXI.Rectangle): boolean {
  return (
    rectangle1.left < rectangle2.right &&
    rectangle1.right > rectangle2.left &&
    rectangle1.top < rectangle2.bottom &&
    rectangle1.bottom > rectangle2.top
  );
}

export const intersects = {
  rectanglePoint,
  rectangleRectangle,
};
