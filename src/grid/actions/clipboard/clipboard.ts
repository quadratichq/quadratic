import * as Sentry from '@sentry/browser';
import localforage from 'localforage';
import { isEditorOrAbove } from '../../../actions';
import { debugTimeCheck, debugTimeReset } from '../../../gridGL/helpers/debugPerformance';
import { pixiAppSettings } from '../../../gridGL/pixiApp/PixiAppSettings';
import { copyAsPNG } from '../../../gridGL/pixiApp/copyAsPNG';
import { grid } from '../../controller/Grid';
import { sheets } from '../../controller/Sheets';

const clipboardLocalStorageKey = 'quadratic-clipboard';

export const fullClipboardSupport = (): boolean => {
  return !!navigator.clipboard && !!window.ClipboardItem;
};

//#region document event handler for copy, paste, and cut

export const copyToClipboardEvent = (e: ClipboardEvent) => {
  debugTimeReset();
  const rectangle = sheets.sheet.cursor.getRectangle();
  const { plainText, html } = grid.copyToClipboard(sheets.sheet.id, rectangle);
  if (!e.clipboardData) {
    Sentry.captureEvent({
      message: 'ClipboardData not defined',
      level: Sentry.Severity.Warning,
    });
    console.warn('clipboardData is not defined');
    return;
  }
  e.clipboardData.setData('text/html', html);
  e.clipboardData.setData('text', plainText);
  e.preventDefault();
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
  localforage.setItem(clipboardLocalStorageKey, html);

  e.preventDefault();
};

//#endregion

//#region triggered via menu (limited support on Firefox)

// copies plainText and html to the clipboard
const toClipboard = (plainText: string, html: string) => {
  // https://github.com/tldraw/tldraw/blob/a85e80961dd6f99ccc717749993e10fa5066bc4d/packages/tldraw/src/state/TldrawApp.ts#L2189
  // browser support clipboard api navigator.clipboard
  if (fullClipboardSupport()) {
    navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      }),
    ]);
  }

  // fallback support for firefox
  else {
    localforage.setItem(clipboardLocalStorageKey, html);
    navigator.clipboard.writeText(plainText);
  }
};

export const cutToClipboard = async () => {
  if (!isEditorOrAbove(pixiAppSettings.permission)) return;
  debugTimeReset();
  const { plainText, html } = grid.cutToClipboard(sheets.sheet.id, sheets.sheet.cursor.getRectangle());
  toClipboard(plainText, html);
  debugTimeCheck('cut to clipboard (fallback)');
};

export const copyToClipboard = () => {
  debugTimeReset();
  const { plainText, html } = grid.copyToClipboard(sheets.sheet.id, sheets.sheet.cursor.getRectangle());
  toClipboard(plainText, html);
  debugTimeCheck('copy to clipboard');
};

export const copySelectionToPNG = async () => {
  const blob = await copyAsPNG();
  if (!blob) {
    throw new Error('Unable to copy as PNG');
  }

  if (fullClipboardSupport()) {
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

  // handles non-Firefox browsers
  if (navigator.clipboard?.read) {
    const clipboardData = await navigator.clipboard.read();

    // get text/plain if available
    const plainTextItem = clipboardData.find((item) => item.types.includes('text/plain'));
    let plainText: string | undefined;
    if (plainTextItem) {
      const item = await plainTextItem.getType('text/plain');
      plainText = await item.text();
    }

    // gets text/html if available
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

  // handles firefox using localStorage :(
  else {
    const html = (await localforage.getItem(clipboardLocalStorageKey)) as string;
    if (html) {
      debugTimeReset();
      grid.pasteFromClipboard({
        sheetId: sheets.sheet.id,
        x: target.x,
        y: target.y,
        plainText: undefined,
        html,
      });
      debugTimeCheck('paste from clipboard (firefox)');
    }
  }
};

//#endregion
