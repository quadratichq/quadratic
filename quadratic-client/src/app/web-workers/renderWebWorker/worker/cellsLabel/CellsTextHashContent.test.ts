import { describe, expect, it } from 'vitest';
import { CellsTextHashContent } from './CellsTextHashContent';
import { sheetHashHeight, sheetHashWidth } from '@/app/gridGL/cells/CellsTypes';

describe('CellsTextHashContent', () => {
  it('should add cells', () => {
    const content = new CellsTextHashContent();
    content.add(0, 0);
    content.add(1, 0);
    content.add(0, 1);
    content.add(1, 1);
    expect(content.hasContent(0, 0)).toBe(true);
    expect(content.hasContent(1, 0)).toBe(true);
    expect(content.hasContent(0, 1)).toBe(true);
    expect(content.hasContent(1, 1)).toBe(true);
    expect(content.hasContent(2, 5)).toBe(false);
  });

  it('should add cells to different hashes', () => {
    const content = new CellsTextHashContent();
    // 0,0 in hash (1,1)
    content.add(sheetHashWidth, sheetHashHeight);
    content.add(sheetHashWidth + 1, sheetHashHeight);
    content.add(sheetHashWidth, sheetHashHeight + 1);
    content.add(sheetHashWidth + 1, sheetHashHeight + 1);
    expect(content.hasContent(sheetHashWidth, sheetHashHeight)).toBe(true);
    expect(content.hasContent(sheetHashWidth + 1, sheetHashHeight + 0)).toBe(true);
    expect(content.hasContent(sheetHashWidth + 0, sheetHashHeight + 1)).toBe(true);
    expect(content.hasContent(sheetHashWidth + 1, sheetHashHeight + 1)).toBe(true);
    expect(content.hasContent(sheetHashWidth + 2, sheetHashHeight + 5)).toBe(false);
  });

  it('should add cells for the entire size of hte hashes', () => {
    const content = new CellsTextHashContent();
    for (let y = 0; y < sheetHashHeight; y++) {
      for (let x = 0; x < sheetHashWidth; x++) {
        if (x % 2 === 0 && y % 2 === 0) {
          content.add(x, y);
        }
      }
    }
    for (let y = 0; y < sheetHashHeight; y++) {
      for (let x = 0; x < sheetHashWidth; x++) {
        expect(content.hasContent(x, y)).toBe(x % 2 === 0 && y % 2 === 0);
      }
    }
  });

  it('imports and exports', () => {
    const content = new CellsTextHashContent();
    content.add(0, 0);
    content.add(1, 0);
    content.add(0, 1);
    content.add(1, 1);
    content.add(sheetHashWidth - 5, sheetHashHeight - 4);
    const bits = content.export();
    const newContent = new CellsTextHashContent();
    newContent.import(bits);
    for (let y = 0; y < sheetHashHeight; y++) {
      for (let x = 0; x < sheetHashWidth; x++) {
        expect(newContent.hasContent(x, y)).toBe(content.hasContent(x, y));
      }
    }
  });
});
