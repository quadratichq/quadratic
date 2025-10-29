import { CellValueType } from '@/app/web-workers/javascriptWebWorker/worker/javascript/runner/javascriptLibrary';
import { describe, expect, it } from 'vitest';
import { javascriptConvertOutputArray, javascriptConvertOutputType } from './javascriptOutput';

describe('javascriptConvertOutputType', () => {
  it('should convert numbers', () => {
    let message: string[] = [];
    expect(javascriptConvertOutputType(message, 123, 0, 0)).toEqual({
      displayType: 'number',
      output: ['123', CellValueType.Number],
    });
    expect(message.length).toBe(0);

    expect(javascriptConvertOutputType(message, Infinity, 0, 0)).toEqual(null);
    expect(message[0].includes("Unsupported output type: 'Infinity'")).toBe(true);

    message = [];
    expect(javascriptConvertOutputType(message, NaN, 0, 0)).toEqual(null);
    expect(message[0].includes("Unsupported output type: 'NaN'")).toBe(true);

    message = [];
    const promise = new Promise(() => 0);
    expect(javascriptConvertOutputType(message, promise.toString(), 0, 0)).toEqual(null);
    expect(message[0].includes('Unsupported output type: `Promise`')).toBe(true);

    message = [];
    expect(javascriptConvertOutputType(message, () => 0, 0, 0)).toEqual(null);
    expect(message[0].includes("Unsupported output type: 'function'")).toBe(true);

    // todo: need something from node to create the Blob
    // message = [];
    // const blob = new Blob([''], { type: 'image/png' });
    // const image = new FileReaderSync().readAsDataURL(blob);
    // expect(javascriptConvertOutputType(message, blob, 0, 0)).toEqual({
    //   output: [image, 'image'],
    //   displayType: 'OffscreenCanvas',
    // });

    message = [];
    expect(javascriptConvertOutputType(message, 'hello', 0, 0)).toEqual({
      displayType: 'string',
      output: ['hello', CellValueType.Text],
    });
    expect(message.length).toBe(0);

    expect(javascriptConvertOutputType(message, undefined, 0, 0)).toEqual(null);
    expect(message.length).toBe(0);

    expect(javascriptConvertOutputType(message, true, 0, 0)).toEqual({
      displayType: 'boolean',
      output: ['true', CellValueType.Logical],
    });
    expect(message.length).toBe(0);

    expect(javascriptConvertOutputType(message, [1, 2, 3], 0, 0)).toEqual(null);
    expect(message.length).toBe(0);

    expect(javascriptConvertOutputType(message, [], 0, 0)).toEqual({
      displayType: 'empty array',
      output: ['', CellValueType.Blank],
    });
    expect(message.length).toBe(0);

    expect(javascriptConvertOutputType(message, [[], [], []], 0, 0)).toEqual({
      displayType: 'empty array',
      output: ['', CellValueType.Blank],
    });
    expect(message.length).toBe(0);
  });

  it('javascriptConvertOutputArray', () => {
    let message: string[] = [];
    expect(javascriptConvertOutputArray(message, [1, 2, 3], 0, 0)).toEqual({
      displayType: 'number[]',
      output: [[['1', CellValueType.Number]], [['2', CellValueType.Number]], [['3', CellValueType.Number]]],
    });
    expect(message.length).toBe(0);

    expect(javascriptConvertOutputArray(message, [], 0, 0)).toEqual(null);
    expect(message.length).toBe(0);

    expect(javascriptConvertOutputArray(message, [[], [], []], 0, 0)).toEqual(null);
    expect(message.length).toBe(0);
  });
});
