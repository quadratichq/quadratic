import { Point, Rectangle } from 'pixi.js';
import { intersects } from '../intersects';

describe('intersects', () => {
  it('Finds the distance between two points (same point)', () => {
    const point1 = new Point(0, 0);
    const point2 = new Point(0, 0);
    expect(intersects.distanceTwoPoints(point1, point2)).toBe(0);
    expect(intersects.distanceTwoPoints(0, 0, 0, 0)).toBe(0);
  });

  it('Finds the distance between two points (different points)', () => {
    const point1 = new Point(0, 0);
    const point2 = new Point(5, 10);
    const distance = Math.sqrt(5 ** 2 + 10 ** 2);
    expect(intersects.distanceTwoPoints(point1, point2)).toBe(distance);
    expect(intersects.distanceTwoPoints(0, 0, 5, 10)).toBe(distance);
  });


  it('Intersects two overlapping rectangles', () => {
    const rectangle1 = new Rectangle(0, 0, 10, 10);
    const rectangle2 = new Rectangle(5, 5, 10, 10);
    expect(intersects.distanceTwoRectangles(rectangle1, rectangle2)).toBe(0);
    expect(intersects.distanceTwoRectangles(rectangle2, rectangle1)).toBe(0);
  });

  it('Finds distance between two rectangles non-overlapping rectangles (to the right and left)', () => {
    const rectangle1 = new Rectangle(0, 0, 10, 10);
    const rectangle2 = new Rectangle(15, 0, 20, 10);
    expect(intersects.distanceTwoRectangles(rectangle1, rectangle2)).toBe(5);
    expect(intersects.distanceTwoRectangles(rectangle2, rectangle1)).toBe(5);
  });

  it('Finds distance between two rectangles non-overlapping rectangles (to the top and bottom)', () => {
    const rectangle1 = new Rectangle(0, 0, 10, 10);
    const rectangle2 = new Rectangle(0, 15, 10, 20);
    expect(intersects.distanceTwoRectangles(rectangle1, rectangle2)).toBe(5);
    expect(intersects.distanceTwoRectangles(rectangle2, rectangle1)).toBe(5);
  });

  it('Finds distance between two rectangles non-overlapping rectangles (to the diagonal)', () => {
    const rectangle1 = new Rectangle(0, 0, 10, 10);
    const rectangle2 = new Rectangle(15, 15, 20, 20);
    expect(intersects.distanceTwoRectangles(rectangle1, rectangle2)).toBe(7.0710678118654755);
    expect(intersects.distanceTwoRectangles(rectangle2, rectangle1)).toBe(7.0710678118654755);
  });
});