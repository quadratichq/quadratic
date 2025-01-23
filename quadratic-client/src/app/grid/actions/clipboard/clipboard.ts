import { hasPermissionToEditFile } from '@/app/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { debugTimeCheck, debugTimeReset } from '@/app/gridGL/helpers/debugPerformance';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { copyAsPNG } from '@/app/gridGL/pixiApp/copyAsPNG';
import type { PasteSpecial } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { GlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import * as Sentry from '@sentry/react';
import localforage from 'localforage';
import mixpanel from 'mixpanel-browser';

const clipboardLocalStorageKey = 'quadratic-clipboard';

export const fullClipboardSupport = (): boolean => {
  return !!navigator.clipboard && !!window.ClipboardItem;
};

//#region document event handler for copy, paste, and cut

// returns if focus is not on the body or canvas or parent of canvas
const canvasIsTarget = () => {
  const target = document.activeElement;
  return target === document.body || target === pixiApp.canvas || (target as HTMLElement)?.contains(pixiApp.canvas);
};

export const copyToClipboardEvent = async (e: ClipboardEvent) => {
  if (!canvasIsTarget()) return;
  e.preventDefault();
  debugTimeReset();
  const jsClipboard = await quadraticCore.copyToClipboard(sheets.getRustSelection());
  await toClipboard(jsClipboard.plainText, jsClipboard.html);
  pixiApp.copy.changeCopyRanges();
  debugTimeCheck('copy to clipboard');
};

export const cutToClipboardEvent = async (e: ClipboardEvent) => {
  if (!canvasIsTarget()) return;
  if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;
  e.preventDefault();
  debugTimeReset();
  const jsClipboard = await quadraticCore.cutToClipboard(sheets.getRustSelection(), sheets.getCursorPosition());
  await toClipboard(jsClipboard.plainText, jsClipboard.html);
  debugTimeCheck('[Clipboard] cut to clipboard');
};

export const pasteFromClipboardEvent = (e: ClipboardEvent) => {
  if (!canvasIsTarget()) return;
  if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;

  if (!e.clipboardData) {
    console.warn('clipboardData is not defined');
    return;
  }
  e.preventDefault();
  let html: string | undefined;
  let plainText: string | undefined;

  if (e.clipboardData.types.includes('text/html')) {
    html = e.clipboardData.getData('text/html');
  }
  if (e.clipboardData.types.includes('text/plain')) {
    plainText = e.clipboardData.getData('text/plain');
  }
  if (plainText || html) {
    quadraticCore.pasteFromClipboard({
      selection: sheets.sheet.cursor.save(),
      plainText,
      html,
      special: 'None',
      cursor: sheets.getCursorPosition(),
    });
  }

  // enables Firefox menu pasting after a ctrl+v paste
  localforage.setItem(clipboardLocalStorageKey, html);
};

//#endregion

//#region triggered via menu (limited support on Firefox)

// copies plainText and html to the clipboard
const toClipboard = async (plainText: string, html: string) => {
  // https://github.com/tldraw/tldraw/blob/a85e80961dd6f99ccc717749993e10fa5066bc4d/packages/tldraw/src/state/TldrawApp.ts#L2189
  // browser support clipboard api navigator.clipboard
  if (fullClipboardSupport()) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      }),
    ]);
  }

  // fallback support for firefox
  else {
    await Promise.all([navigator.clipboard.writeText(plainText), localforage.setItem(clipboardLocalStorageKey, html)]);
  }
};

export const cutToClipboard = async () => {
  if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;
  debugTimeReset();
  const jsClipboard = await quadraticCore.cutToClipboard(sheets.getRustSelection(), sheets.getCursorPosition());
  await toClipboard(jsClipboard.plainText, jsClipboard.html);
  debugTimeCheck('cut to clipboard (fallback)');
};

export const copyToClipboard = async () => {
  debugTimeReset();
  const jsClipboard = await quadraticCore.copyToClipboard(sheets.getRustSelection());
  await toClipboard(jsClipboard.plainText, jsClipboard.html);
  pixiApp.copy.changeCopyRanges();
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

export const pasteFromClipboard = async (special: PasteSpecial = 'None') => {
  if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;

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
    quadraticCore.pasteFromClipboard({
      selection: sheets.sheet.cursor.save(),
      plainText,
      html,
      special,
      cursor: sheets.getCursorPosition(),
    });
  }

  // handles firefox using localStorage :(
  else {
    const html = (await localforage.getItem(clipboardLocalStorageKey)) as string;
    if (html) {
      quadraticCore.pasteFromClipboard({
        selection: sheets.sheet.cursor.save(),
        plainText: undefined,
        html,
        special,
        cursor: sheets.getCursorPosition(),
      });
    }
  }
};

//#endregion
