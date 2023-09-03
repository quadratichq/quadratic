import { Rectangle } from 'pixi.js';
import { debugTimeCheck, debugTimeReset } from '../../../gridGL/helpers/debugPerformance';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { copyAsPNG } from '../../../gridGL/pixiApp/copyAsPNG';
import { Coordinate } from '../../../gridGL/types/size';
import { SheetController } from '../../controller/SheetController';
import { transactionResponse } from '../../controller/transactionResponse';

// copies plainText and html to the clipboard
const toClipboard = (plainText: string, html: string) => {
  // https://github.com/tldraw/tldraw/blob/a85e80961dd6f99ccc717749993e10fa5066bc4d/packages/tldraw/src/state/TldrawApp.ts#L2189
  if (navigator.clipboard && window.ClipboardItem) {
    // browser support clipboard api navigator.clipboard
    navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      }),
    ]);
  } else {
    // fallback to textarea
    const textarea = document.createElement('textarea');
    textarea.value = plainText;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
};

export const copyToClipboard = (sheetController: SheetController, cell0: Coordinate, cell1: Coordinate) => {
  debugTimeReset();
  const { plainText, html } = sheetController.grid.copyToClipboard(
    sheetController.sheet.id,
    new Rectangle(cell0.x, cell0.y, cell1.x - cell0.x, cell1.y - cell0.y)
  );
  toClipboard(plainText, html);
  debugTimeCheck('copy to clipboard');
};

export const cutToClipboard = async (sheetController: SheetController, cell0: Coordinate, cell1: Coordinate) => {
  const { summary, plainText, html } = sheetController.grid.cutToClipboard(
    sheetController.sheet.id,
    new Rectangle(cell0.x, cell0.y, cell1.x - cell0.x, cell1.y - cell0.y),
    sheetController.sheet.cursor.save()
  );
  toClipboard(plainText, html);
  if (!summary) throw new Error('Expected summary to be defined in cutToClipboard');
  transactionResponse(sheetController, summary);
};

export const copySelectionToPNG = async (app: PixiApp) => {
  const blob = await copyAsPNG(app);
  if (!blob) {
    throw new Error('Unable to copy as PNG');
  }
  if (navigator.clipboard && window.ClipboardItem) {
    navigator.clipboard.write([
      new ClipboardItem({
        //@ts-ignore
        'image/png': blob,
      }),
    ]);
  }
};

export const pasteFromClipboard = async (sheetController: SheetController, target: Coordinate) => {
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      const clipboardData = await navigator.clipboard.read();
      const plainTextItem = clipboardData.find((item) => item.types.includes('text/plain'));
      let plainText: string | undefined;
      if (plainTextItem) {
        const item = await plainTextItem.getType('text/plain');
        plainText = await item.text();
      }
      let html: string | undefined;
      const htmlItem = clipboardData.find((item) => item.types.includes('text/html'));
      if (htmlItem) {
        const item = await htmlItem.getType('text/html');
        html = await item.text();
      }
      debugTimeReset();
      const summary = sheetController.grid.pasteFromClipboard({
        sheetId: sheetController.sheet.id,
        x: target.x,
        y: target.y,
        plainText,
        html,
        cursor: sheetController.sheet.cursor.save(),
      });
      debugTimeCheck('paste from clipboard');
      transactionResponse(sheetController, summary);
    } catch (e) {
      console.warn(e);
    }
  }
};
