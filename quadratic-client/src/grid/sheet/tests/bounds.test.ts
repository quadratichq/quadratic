import { Rectangle } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { Bounds } from '../Bounds';

describe('bounds', () => {
  it('creates an empty bounds', () => {
    const bounds = new Bounds();
    expect(bounds.empty).toBe(true);
    expect(bounds.contains(0, 0)).toBe(false);
  });

  it('adds locations to a bounds', () => {
    const bounds = new Bounds();
    bounds.add(0, 1);
    expect(bounds.empty).toBe(false);
    expect(bounds.contains(0, 1)).toBe(true);
    expect(bounds.contains(0, 0)).toBe(false);
    bounds.add(-1, -2);
    expect(bounds.empty).toBe(false);
    expect(bounds.contains(0, 1)).toBe(true);
    expect(bounds.contains(0, 0)).toBe(true);
    expect(bounds.contains(-1, -2)).toBe(true);
    expect(bounds.contains(1, 2)).toBe(false);
  });

  it('adds a coordinate to a bounds', () => {
    const bounds = new Bounds();
    bounds.addCoordinate({ x: 0, y: 1 });
    expect(bounds.empty).toBe(false);
    expect(bounds.contains(0, 1)).toBe(true);
    expect(bounds.contains(0, 0)).toBe(false);
    bounds.addCoordinate({ x: -1, y: -2 });
    expect(bounds.empty).toBe(false);
    expect(bounds.contains(0, 1)).toBe(true);
    expect(bounds.contains(0, 0)).toBe(true);
    expect(bounds.contains(-1, -2)).toBe(true);
    expect(bounds.contains(1, 2)).toBe(false);
  });

  it('copies bounds', () => {
    const bounds = new Bounds();
    bounds.add(0, 1);
    bounds.add(-1, -2);
    const bounds2 = new Bounds();
    bounds2.add(3, 4);
    bounds2.copy(bounds);
    expect(bounds2.empty).toBe(false);
    expect(bounds2.contains(0, 1)).toBe(true);
    expect(bounds2.contains(0, 0)).toBe(true);
    expect(bounds2.contains(-1, -2)).toBe(true);
    expect(bounds2.contains(1, 2)).toBe(false);
    expect(bounds2.contains(3, 4)).toBe(false);
  });

  it('generates a Rectangle from bounds', () => {
    const bounds = new Bounds();
    bounds.add(0, 1);
    bounds.add(-1, -2);
    expect(bounds.toRectangle()).toEqual(new Rectangle(-1, -2, 1, 3));
  });

  it('returns undefined for an empty Rectangle', () => {
    const bounds = new Bounds();
    expect(bounds.toRectangle()).toBe(undefined);
  });

  it('merges bounds', () => {
    const bounds = new Bounds();
    bounds.add(0, 1);
    bounds.add(-1, -2);
    const bounds2 = new Bounds();
    bounds2.add(3, 4);
    bounds2.mergeInto(bounds);
    expect(bounds2.empty).toBe(false);
    expect(bounds2.contains(0, 1)).toBe(true);
    expect(bounds2.contains(0, 0)).toBe(true);
    expect(bounds2.contains(-1, -2)).toBe(true);
    expect(bounds2.contains(1, 2)).toBe(true);
    expect(bounds2.contains(3, 4)).toBe(true);
    expect(bounds2.contains(4, 5)).toBe(false);
  });

  it('merges multiple bounds', () => {
    const bounds = new Bounds();
    bounds.add(0, 1);
    bounds.add(-1, -2);
    const boundsA = new Bounds();
    boundsA.add(-3, -4);
    const bounds2 = new Bounds();
    bounds2.add(3, 4);
    bounds2.mergeInto(bounds, boundsA);
    expect(bounds2.empty).toBe(false);
    expect(bounds2.contains(0, 1)).toBe(true);
    expect(bounds2.contains(0, 0)).toBe(true);
    expect(bounds2.contains(-1, -2)).toBe(true);
    expect(bounds2.contains(1, 2)).toBe(true);
    expect(bounds2.contains(3, 4)).toBe(true);
    expect(bounds2.contains(4, 5)).toBe(false);
    expect(bounds2.contains(-3, -4)).toBe(true);
  });

  it('merges multiple bounds starting from empty', () => {
    const bounds = new Bounds();
    bounds.add(0, 1);
    bounds.add(-1, -2);
    const boundsA = new Bounds();
    boundsA.add(-3, -4);
    const bounds2 = new Bounds();
    bounds2.mergeInto(bounds, boundsA);
    expect(bounds2.empty).toBe(false);
    expect(bounds2.contains(0, 1)).toBe(true);
    expect(bounds2.contains(0, 0)).toBe(true);
    expect(bounds2.contains(-1, -2)).toBe(true);
    expect(bounds2.contains(1, 2)).toBe(false);
    expect(bounds2.contains(3, 4)).toBe(false);
    expect(bounds2.contains(4, 5)).toBe(false);
    expect(bounds2.contains(-3, -4)).toBe(true);
  });
});
