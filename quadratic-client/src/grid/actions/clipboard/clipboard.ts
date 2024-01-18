import * as Sentry from '@sentry/react';
import localforage from 'localforage';
import mixpanel from 'mixpanel-browser';
import { hasPermissionToEditFile } from '../../../actions';
import { GlobalSnackbar } from '../../../components/GlobalSnackbarProvider';
import { debugTimeCheck, debugTimeReset } from '../../../gridGL/helpers/debugPerformance';
import { pixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '../../../gridGL/pixiApp/PixiAppSettings';
import { copyAsPNG } from '../../../gridGL/pixiApp/copyAsPNG';
import { grid } from '../../controller/Grid';
import { sheets } from '../../controller/Sheets';

const clipboardLocalStorageKey = 'quadratic-clipboard';

export const fullClipboardSupport = (): boolean => {
  return !!navigator.clipboard && !!window.ClipboardItem;
};

//#region document event handler for copy, paste, and cut

// returns if focus is not on the body or canvas or parent of canvas
const canvasIsTarget = (e: ClipboardEvent) => {
  return (
    e.target === document.body || e.target === pixiApp.canvas || (e.target as HTMLElement)?.contains(pixiApp.canvas)
  );
};

export const copyToClipboardEvent = (e: ClipboardEvent) => {
  if (!canvasIsTarget(e)) return;
  debugTimeReset();
  const rectangle = sheets.sheet.cursor.getRectangle();
  const { plainText, html } = grid.copyToClipboard(sheets.sheet.id, rectangle);
  toClipboard(plainText, html);
  e.preventDefault();
  debugTimeCheck('copy to clipboard');
};

export const cutToClipboardEvent = async (e: ClipboardEvent) => {
  if (!canvasIsTarget(e)) return;
  if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;
  debugTimeReset();
  const rectangle = sheets.sheet.cursor.getRectangle();
  const { plainText, html } = await grid.cutToClipboard(sheets.sheet.id, rectangle);
  if (!e.clipboardData) {
    console.warn('clipboardData is not defined');
    return;
  }
  e.clipboardData.setData('text/html', html);
  e.clipboardData.setData('text', plainText);
  e.preventDefault();
  debugTimeCheck('[Clipboard] cut to clipboard');
};

export const pasteFromClipboardEvent = (e: ClipboardEvent) => {
  if (!canvasIsTarget(e)) return;
  if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;

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
    debugTimeCheck('[Clipboard] paste to clipboard');
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
    navigator.clipboard.writeText(plainText);
    localforage.setItem(clipboardLocalStorageKey, html);
  }
};

export const cutToClipboard = async () => {
  if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;
  debugTimeReset();
  const { plainText, html } = await grid.cutToClipboard(sheets.sheet.id, sheets.sheet.cursor.getRectangle());
  toClipboard(plainText, html);
  debugTimeCheck('cut to clipboard (fallback)');
};

export const copyToClipboard = () => {
  debugTimeReset();
  const { plainText, html } = grid.copyToClipboard(sheets.sheet.id, sheets.sheet.cursor.getRectangle());
  toClipboard(plainText, html);
  debugTimeCheck('copy to clipboard');
};

export const copySelectionToPNG = async (addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar']) => {
  try {
    const blob = await copyAsPNG();
    if (!blob) {
      throw new Error('The function `copyAsPng` failed to return data');
    }

    if (!fullClipboardSupport()) {
      console.log('copy to PNG is not supported in Firefox (yet)');
      mixpanel.track('[clipboard].copySelectionToPNG.notSupported');
      return;
    }

    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
      }),
    ]);

    addGlobalSnackbar('Copied selection as PNG to clipboard');
  } catch (error) {
    console.error(error);
    addGlobalSnackbar('Failed to copy selection as PNG.', { severity: 'error' });
    Sentry.captureException(error);
  }
};

export const pasteFromClipboard = async () => {
  if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;
  const target = sheets.sheet.cursor.originPosition;

  if (fullClipboardSupport()) {
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
