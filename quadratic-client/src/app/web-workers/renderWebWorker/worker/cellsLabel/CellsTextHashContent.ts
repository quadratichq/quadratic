//! This tracks what cells have content within a CellsTextHash. One cell is a
//! bit in a number.

import { sheetHashHeight, sheetHashWidth } from '@/app/gridGL/cells/CellsTypes';
import { mod } from '@/shared/utils/mod';

const numberBits = sheetHashWidth * sheetHashHeight;
const numberIntegers = Math.ceil(numberBits / 32);

export class CellsTextHashContent {
  private bits = new Uint32Array(numberIntegers).fill(0);

  clear() {
    this.bits.fill(0);
  }

  private getBitIndex(x: number | BigInt, y: number | BigInt): number {
    x = mod(Number(x), sheetHashWidth);
    y = mod(Number(y), sheetHashHeight);
    return y * sheetHashWidth + x;
  }

  private getBitPosition(index: number): number {
    return index % 32;
  }

  // adds a cell w/content to the hash
  add(x: number | BigInt, y: number | BigInt) {
    x = mod(Number(x), sheetHashWidth);
    y = mod(Number(y), sheetHashHeight);
    const index = this.getBitIndex(x, y);
    const position = this.getBitPosition(index);
    this.bits[Math.floor(index / 32)] |= 1 << position;
  }

  // checks whether a cell has content
  hasContent(x: number, y: number): boolean {
    x = mod(x, sheetHashWidth);
    y = mod(y, sheetHashHeight);
    const index = this.getBitIndex(x, y);
    const position = this.getBitPosition(index);
    return (this.bits[Math.floor(index / 32)] & (1 << position)) !== 0;
  }

  export(): Uint32Array {
    return this.bits;
  }

  import(bits: Uint32Array) {
    this.bits = bits;
  }
}
