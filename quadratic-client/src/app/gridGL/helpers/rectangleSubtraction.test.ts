import { Rectangle } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { rectangleSubtraction } from './rectangleSubtraction';

describe('subtractRectangle', () => {
  describe('no intersection', () => {
    it('should return original rectangle when subtract is completely to the right', () => {
      const from = new Rectangle(0, 0, 100, 100);
      const subtract = new Rectangle(200, 0, 100, 100);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(from);
    });

    it('should return original rectangle when subtract is completely to the left', () => {
      const from = new Rectangle(200, 0, 100, 100);
      const subtract = new Rectangle(0, 0, 100, 100);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(from);
    });

    it('should return original rectangle when subtract is completely above', () => {
      const from = new Rectangle(0, 200, 100, 100);
      const subtract = new Rectangle(0, 0, 100, 100);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(from);
    });

    it('should return original rectangle when subtract is completely below', () => {
      const from = new Rectangle(0, 0, 100, 100);
      const subtract = new Rectangle(0, 200, 100, 100);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(from);
    });
  });

  describe('complete containment', () => {
    it('should return 4 rectangles when subtract is centered inside from', () => {
      const from = new Rectangle(0, 0, 100, 100);
      const subtract = new Rectangle(25, 25, 50, 50);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(4);

      // Top rectangle
      expect(result[0]).toEqual(new Rectangle(0, 0, 100, 25));

      // Bottom rectangle
      expect(result[1]).toEqual(new Rectangle(0, 75, 100, 25));

      // Left rectangle
      expect(result[2]).toEqual(new Rectangle(0, 25, 25, 50));

      // Right rectangle
      expect(result[3]).toEqual(new Rectangle(75, 25, 25, 50));
    });

    it('should handle subtract touching top edge', () => {
      const from = new Rectangle(0, 0, 100, 100);
      const subtract = new Rectangle(25, 0, 50, 50);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(3);
      // No top rectangle (touches edge)
      // Bottom, left, right
      expect(result[0]).toEqual(new Rectangle(0, 50, 100, 50)); // Bottom
      expect(result[1]).toEqual(new Rectangle(0, 0, 25, 50)); // Left
      expect(result[2]).toEqual(new Rectangle(75, 0, 25, 50)); // Right
    });

    it('should handle subtract touching bottom edge', () => {
      const from = new Rectangle(0, 0, 100, 100);
      const subtract = new Rectangle(25, 50, 50, 50);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(new Rectangle(0, 0, 100, 50)); // Top
      // No bottom rectangle (touches edge)
      expect(result[1]).toEqual(new Rectangle(0, 50, 25, 50)); // Left
      expect(result[2]).toEqual(new Rectangle(75, 50, 25, 50)); // Right
    });

    it('should handle subtract touching left edge', () => {
      const from = new Rectangle(0, 0, 100, 100);
      const subtract = new Rectangle(0, 25, 50, 50);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(new Rectangle(0, 0, 100, 25)); // Top
      expect(result[1]).toEqual(new Rectangle(0, 75, 100, 25)); // Bottom
      // No left rectangle (touches edge)
      expect(result[2]).toEqual(new Rectangle(50, 25, 50, 50)); // Right
    });

    it('should handle subtract touching right edge', () => {
      const from = new Rectangle(0, 0, 100, 100);
      const subtract = new Rectangle(50, 25, 50, 50);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(new Rectangle(0, 0, 100, 25)); // Top
      expect(result[1]).toEqual(new Rectangle(0, 75, 100, 25)); // Bottom
      expect(result[2]).toEqual(new Rectangle(0, 25, 50, 50)); // Left
      // No right rectangle (touches edge)
    });
  });

  describe('partial overlaps', () => {
    it('should handle overlap from top', () => {
      const from = new Rectangle(0, 50, 100, 100);
      const subtract = new Rectangle(25, 0, 50, 75);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(3);
      // No top rectangle (subtract extends above)
      expect(result[0]).toEqual(new Rectangle(0, 75, 100, 75)); // Bottom
      expect(result[1]).toEqual(new Rectangle(0, 50, 25, 25)); // Left
      expect(result[2]).toEqual(new Rectangle(75, 50, 25, 25)); // Right
    });

    it('should handle overlap from bottom', () => {
      const from = new Rectangle(0, 0, 100, 100);
      const subtract = new Rectangle(25, 75, 50, 50);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(new Rectangle(0, 0, 100, 75)); // Top
      // No bottom rectangle (subtract extends below)
      expect(result[1]).toEqual(new Rectangle(0, 75, 25, 25)); // Left
      expect(result[2]).toEqual(new Rectangle(75, 75, 25, 25)); // Right
    });

    it('should handle overlap from left', () => {
      const from = new Rectangle(50, 0, 100, 100);
      const subtract = new Rectangle(0, 25, 75, 50);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(new Rectangle(50, 0, 100, 25)); // Top
      expect(result[1]).toEqual(new Rectangle(50, 75, 100, 25)); // Bottom
      // No left rectangle (subtract extends left)
      expect(result[2]).toEqual(new Rectangle(75, 25, 75, 50)); // Right
    });

    it('should handle overlap from right', () => {
      const from = new Rectangle(0, 0, 100, 100);
      const subtract = new Rectangle(75, 25, 50, 50);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(new Rectangle(0, 0, 100, 25)); // Top
      expect(result[1]).toEqual(new Rectangle(0, 75, 100, 25)); // Bottom
      expect(result[2]).toEqual(new Rectangle(0, 25, 75, 50)); // Left
      // No right rectangle (subtract extends right)
    });
  });

  describe('corner overlaps', () => {
    it('should handle top-left corner overlap', () => {
      const from = new Rectangle(50, 50, 100, 100);
      const subtract = new Rectangle(0, 0, 75, 75);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(2);
      // No top rectangle (subtract extends above)
      expect(result[0]).toEqual(new Rectangle(50, 75, 100, 75)); // Bottom
      // No left rectangle (subtract extends left)
      expect(result[1]).toEqual(new Rectangle(75, 50, 75, 25)); // Right
    });

    it('should handle top-right corner overlap', () => {
      const from = new Rectangle(0, 50, 100, 100);
      const subtract = new Rectangle(75, 0, 100, 75);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(2);
      // No top rectangle (subtract extends above)
      expect(result[0]).toEqual(new Rectangle(0, 75, 100, 75)); // Bottom
      expect(result[1]).toEqual(new Rectangle(0, 50, 75, 25)); // Left
      // No right rectangle (subtract extends right)
    });

    it('should handle bottom-left corner overlap', () => {
      const from = new Rectangle(50, 0, 100, 100);
      const subtract = new Rectangle(0, 75, 75, 100);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(new Rectangle(50, 0, 100, 75)); // Top
      // No bottom rectangle (subtract extends below)
      // No left rectangle (subtract extends left)
      expect(result[1]).toEqual(new Rectangle(75, 75, 75, 25)); // Right
    });

    it('should handle bottom-right corner overlap', () => {
      const from = new Rectangle(0, 0, 100, 100);
      const subtract = new Rectangle(75, 75, 100, 100);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(new Rectangle(0, 0, 100, 75)); // Top
      // No bottom rectangle (subtract extends below)
      expect(result[1]).toEqual(new Rectangle(0, 75, 75, 25)); // Left
      // No right rectangle (subtract extends right)
    });
  });

  describe('edge cases', () => {
    it('should return empty array when subtract completely covers from', () => {
      const from = new Rectangle(50, 50, 100, 100);
      const subtract = new Rectangle(0, 0, 200, 200);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(0);
    });

    it('should return empty array when rectangles are identical', () => {
      const from = new Rectangle(0, 0, 100, 100);
      const subtract = new Rectangle(0, 0, 100, 100);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(0);
    });

    it('should handle subtract that spans full width', () => {
      const from = new Rectangle(0, 0, 100, 100);
      const subtract = new Rectangle(0, 25, 100, 50);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(new Rectangle(0, 0, 100, 25)); // Top
      expect(result[1]).toEqual(new Rectangle(0, 75, 100, 25)); // Bottom
      // No left or right (subtract spans full width)
    });

    it('should handle subtract that spans full height', () => {
      const from = new Rectangle(0, 0, 100, 100);
      const subtract = new Rectangle(25, 0, 50, 100);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(2);
      // No top or bottom (subtract spans full height)
      expect(result[0]).toEqual(new Rectangle(0, 0, 25, 100)); // Left
      expect(result[1]).toEqual(new Rectangle(75, 0, 25, 100)); // Right
    });

    it('should handle rectangles with floating point coordinates', () => {
      const from = new Rectangle(0.5, 0.5, 100.5, 100.5);
      const subtract = new Rectangle(25.25, 25.25, 50.5, 50.5);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual(new Rectangle(0.5, 0.5, 100.5, 24.75)); // Top
      expect(result[1]).toEqual(new Rectangle(0.5, 75.75, 100.5, 25.25)); // Bottom
      expect(result[2]).toEqual(new Rectangle(0.5, 25.25, 24.75, 50.5)); // Left
      expect(result[3]).toEqual(new Rectangle(75.75, 25.25, 25.25, 50.5)); // Right
    });

    it('should handle very small rectangles', () => {
      const from = new Rectangle(0, 0, 10, 10);
      const subtract = new Rectangle(4, 4, 2, 2);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual(new Rectangle(0, 0, 10, 4)); // Top
      expect(result[1]).toEqual(new Rectangle(0, 6, 10, 4)); // Bottom
      expect(result[2]).toEqual(new Rectangle(0, 4, 4, 2)); // Left
      expect(result[3]).toEqual(new Rectangle(6, 4, 4, 2)); // Right
    });
  });

  describe('touching edges (no overlap)', () => {
    it('should return original when subtract touches right edge', () => {
      const from = new Rectangle(0, 0, 100, 100);
      const subtract = new Rectangle(100, 0, 50, 100);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(from);
    });

    it('should return original when subtract touches bottom edge', () => {
      const from = new Rectangle(0, 0, 100, 100);
      const subtract = new Rectangle(0, 100, 100, 50);
      const result = rectangleSubtraction(from, subtract);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(from);
    });
  });
});
