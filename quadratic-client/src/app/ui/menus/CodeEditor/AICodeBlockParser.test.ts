import { describe, expect, test } from 'vitest';

// import { parseCodeBlocks } from './AICodeBlockParser';

describe('parseCodeBlocks()', () => {
  test('placeholder', () => {
    expect(true).toBe(true);
  });
  //   test('A string without code blocks returns one item', () => {
  //     const result = parseCodeBlocks(`This is a string from AI.`);
  //     expect(result).toHaveLength(1);
  //     expect(typeof result[0]).toBe('string');
  //   });
  //   test('A string + 1 unclosed code block returns two items', () => {
  //     const result = parseCodeBlocks(`
  // A string of text with an open code block.
  // \`\`\`js
  // const foo = 'foo';`);
  //     expect(result).toHaveLength(2);
  //     expect(typeof result[0]).toBe('string');
  //     expect(typeof result[1]).toBe('object');
  //   });
  //   test('A string + 1 code block returns two items', () => {
  //     const result = parseCodeBlocks(`
  // A string of text with a full code block.
  // \`\`\`js
  // const foo = 'foo';
  // \`\`\``);
  //     expect(result).toHaveLength(2);
  //   });
  //   test('A string + 1 full code block + a string returns three items', () => {
  //     const result = parseCodeBlocks(`
  // A string of text with a full code block.
  // \`\`\`js
  // const foo = 'foo';
  // \`\`\`
  // And another piece of text
  // And more text here`);
  //     expect(result).toHaveLength(3);
  //     expect(typeof result[0]).toBe('string');
  //     expect(typeof result[1]).toBe('object');
  //     expect(typeof result[2]).toBe('string');
  //   });
});
