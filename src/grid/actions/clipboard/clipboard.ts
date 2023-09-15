import { isEditorOrAbove } from '../../../actions';
import { debugTimeCheck, debugTimeReset } from '../../../gridGL/helpers/debugPerformance';
import { pixiAppSettings } from '../../../gridGL/pixiApp/PixiAppSettings';
import { copyAsPNG } from '../../../gridGL/pixiApp/copyAsPNG';
import { grid } from '../../controller/Grid';
import { sheets } from '../../controller/Sheets';

//#region document event handler for copy, paste, and cut

export const copyToClipboardEvent = (e: ClipboardEvent) => {
  debugTimeReset();
  const rectangle = sheets.sheet.cursor.getRectangle();
  const { plainText, html } = grid.copyToClipboard(sheets.sheet.id, rectangle);
  if (!e.clipboardData) {
    console.warn('clipboardData is not defined');
    return;
  }
  e.clipboardData.setData('text/html', html);
  e.clipboardData.setData('text', plainText);
  e.preventDefault();
  debugTimeCheck('copy to clipboard');
};

// only used on menu copy (using fallback with FireFox)
export const copyToClipboard = () => {
  debugTimeReset();
  const { plainText, html } = grid.copyToClipboard(sheets.sheet.id, sheets.sheet.cursor.getRectangle());
  toClipboard(plainText, html);
  debugTimeCheck('copy to clipboard');
};

export const cutToClipboardEvent = (e: ClipboardEvent) => {
  if (!isEditorOrAbove(pixiAppSettings.permission)) return;
  debugTimeReset();
  const rectangle = sheets.sheet.cursor.getRectangle();
  const { plainText, html } = grid.cutToClipboard(sheets.sheet.id, rectangle);
  if (!e.clipboardData) {
    console.warn('clipboardData is not defined');
    return;
  }
  e.clipboardData.setData('text/html', html);
  e.clipboardData.setData('text', plainText);
  e.preventDefault();
  debugTimeCheck('cut to clipboard');
};

export const pasteFromClipboardEvent = (e: ClipboardEvent) => {
  if (!isEditorOrAbove(pixiAppSettings.permission)) return;

  if (!e.clipboardData) {
    console.warn('clipboardData is not defined');
    return;
  }
  const cursor = sheets.sheet.cursor.originPosition;
  let html: string | undefined;
  let plainText: string | undefined;

  if (e.clipboardData.types.includes('text/html')) {
    html = e.clipboardData.getData('text/html');
  }
  if (e.clipboardData.types.includes('text/plain')) {
    plainText = e.clipboardData.getData('text/plain');
  }
  if (plainText || html) {
    debugTimeReset();
    grid.pasteFromClipboard({
      sheetId: sheets.sheet.id,
      x: cursor.x,
      y: cursor.y,
      plainText,
      html,
    });
  }

  // enables Firefox menu pasting after a ctrl+v paste
  lastCopy = html;

  e.preventDefault();
};

//#regionend

//#region triggered via menu (limited support on Firefox)

// workaround so Firefox can copy/paste within same app
let lastCopy: string | undefined = undefined;

// copies plainText and html to the clipboard
const toClipboard = (plainText: string, html: string) => {
  // https://github.com/tldraw/tldraw/blob/a85e80961dd6f99ccc717749993e10fa5066bc4d/packages/tldraw/src/state/TldrawApp.ts#L2189
  if (navigator.clipboard) {
    // browser support clipboard api navigator.clipboard
    if (window.ClipboardItem) {
      navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ]);
    }

    // fallback support for firefox
    else {
      lastCopy = html;
      navigator.clipboard.writeText(plainText);
    }
  }

  // this is probably not needed in modern browsers
  else {
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

export const cutToClipboard = async () => {
  if (!isEditorOrAbove(pixiAppSettings.permission)) return;
  debugTimeReset();
  const { plainText, html } = grid.cutToClipboard(sheets.sheet.id, sheets.sheet.cursor.getRectangle());
  toClipboard(plainText, html);
  debugTimeCheck('cut to clipboard (fallback)');
};

export const copySelectionToPNG = async () => {
  const blob = await copyAsPNG();
  if (!blob) {
    throw new Error('Unable to copy as PNG');
  }

  // todo: this does not work in firefox
  if (navigator.clipboard && window.ClipboardItem) {
    navigator.clipboard.write([
      new ClipboardItem({
        //@ts-ignore
        'image/png': blob,
      }),
    ]);
  } else {
    console.log('copy to PNG is not supported in Firefox (yet)');
  }
};

export const pasteFromClipboard = async () => {
  if (!isEditorOrAbove(pixiAppSettings.permission)) return;
  const target = sheets.sheet.cursor.originPosition;

  if (navigator.clipboard?.read) {
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
    grid.pasteFromClipboard({
      sheetId: sheets.sheet.id,
      x: target.x,
      y: target.y,
      plainText,
      html,
    });
    debugTimeCheck('paste from clipboard');
  }
  // handle firefox :(
  else if (lastCopy) {
    debugTimeReset();
    grid.pasteFromClipboard({
      sheetId: sheets.sheet.id,
      x: target.x,
      y: target.y,
      plainText: undefined,
      html: lastCopy,
    });
    debugTimeCheck('paste from clipboard (firefox)');
  }
};

//#regionend
