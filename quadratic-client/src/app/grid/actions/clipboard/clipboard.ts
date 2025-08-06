import { hasPermissionToEditFile } from '@/app/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { debugTimeCheck, debugTimeReset } from '@/app/gridGL/helpers/debugPerformance';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { copyAsPNG } from '@/app/gridGL/pixiApp/copyAsPNG';
import type { JsClipboard, PasteSpecial } from '@/app/quadratic-core-types';
import { toUint8Array } from '@/app/shared/utils/Uint8Array';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { sendAnalyticsError } from '@/shared/utils/error';
import localforage from 'localforage';
import mixpanel from 'mixpanel-browser';
import { isSafari } from 'react-device-detect';

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

const clipboardSendAnalyticsError = (from: string, error: Error | unknown) => {
  sendAnalyticsError('clipboard', from, error);
};

export const copyToClipboardEvent = async (e: ClipboardEvent) => {
  try {
    if (!canvasIsTarget()) return;
    e.preventDefault();
    debugTimeReset();
    await toClipboardCopy();
    pixiApp.copy.changeCopyRanges();
    debugTimeCheck('copy to clipboard');
  } catch (error) {
    clipboardSendAnalyticsError('copyToClipboardEvent', error);
    pixiAppSettings.addGlobalSnackbar?.('Failed to copy to clipboard.', { severity: 'error' });
  }
};

export const cutToClipboardEvent = async (e: ClipboardEvent) => {
  try {
    if (!canvasIsTarget()) return;
    if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;
    e.preventDefault();
    debugTimeReset();
    await toClipboardCut();
    debugTimeCheck('[Clipboard] cut to clipboard');
  } catch (error) {
    clipboardSendAnalyticsError('cutToClipboardEvent', error);
    pixiAppSettings.addGlobalSnackbar?.('Failed to cut to clipboard.', { severity: 'error' });
  }
};

export const pasteFromClipboardEvent = (e: ClipboardEvent) => {
  try {
    if (!canvasIsTarget()) return;
    if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;

    if (!e.clipboardData) {
      console.warn('clipboardData is not defined');
      return;
    }
    e.preventDefault();

    let plainText = '';
    if (e.clipboardData.types.includes('text/plain')) {
      plainText = e.clipboardData.getData('text/plain');
    }

    let html = '';
    if (e.clipboardData.types.includes('text/html')) {
      html = e.clipboardData.getData('text/html');
    }

    if (plainText || html) {
      const jsClipboard: JsClipboard = {
        plainText,
        html,
      };
      const jsClipboardUint8Array = toUint8Array(jsClipboard);
      plainText = '';
      html = '';

      quadraticCore.pasteFromClipboard({
        selection: sheets.sheet.cursor.save(),
        jsClipboard: jsClipboardUint8Array,
        special: 'None',
      });
    }

    // enables Firefox menu pasting after a ctrl+v paste
    localforage.setItem(clipboardLocalStorageKey, html);
  } catch (error) {
    clipboardSendAnalyticsError('pasteFromClipboardEvent', error);
    pixiAppSettings.addGlobalSnackbar?.('Failed to paste from clipboard.', { severity: 'error' });
  }
};

//#endregion

//#region triggered via menu (limited support on Firefox)

// cuts plainText and html to the clipboard
const toClipboardCut = async () => {
  // https://github.com/tldraw/tldraw/blob/a85e80961dd6f99ccc717749993e10fa5066bc4d/packages/tldraw/src/state/TldrawApp.ts#L2189
  // browser support clipboard api navigator.clipboard
  if (fullClipboardSupport()) {
    if (isSafari) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': quadraticCore
            .copyToClipboard(sheets.getRustSelection())
            .then(({ html }) => new Blob([html], { type: 'text/html' })),
          'text/plain': quadraticCore
            .cutToClipboard(sheets.getRustSelection())
            .then(({ plainText }) => new Blob([plainText], { type: 'text/plain' })),
        }),
      ]);
    } else {
      const { plainText, html } = await quadraticCore.cutToClipboard(sheets.getRustSelection());
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ]);
    }
  }

  // fallback support for firefox
  else {
    const { plainText, html } = await quadraticCore.cutToClipboard(sheets.getRustSelection());
    await Promise.all([navigator.clipboard.writeText(plainText), localforage.setItem(clipboardLocalStorageKey, html)]);
  }
};

// copies plainText and html to the clipboard
const toClipboardCopy = async () => {
  // https://github.com/tldraw/tldraw/blob/a85e80961dd6f99ccc717749993e10fa5066bc4d/packages/tldraw/src/state/TldrawApp.ts#L2189
  // browser support clipboard api navigator.clipboard
  if (fullClipboardSupport()) {
    if (isSafari) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': quadraticCore
            .copyToClipboard(sheets.getRustSelection())
            .then(({ html }) => new Blob([html], { type: 'text/html' })),
          'text/plain': quadraticCore
            .copyToClipboard(sheets.getRustSelection())
            .then(({ plainText }) => new Blob([plainText], { type: 'text/plain' })),
        }),
      ]);
    } else {
      const { plainText, html } = await quadraticCore.copyToClipboard(sheets.getRustSelection());
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ]);
    }
  }

  // fallback support for firefox
  else {
    const { plainText, html } = await quadraticCore.copyToClipboard(sheets.getRustSelection());
    await Promise.all([navigator.clipboard.writeText(plainText), localforage.setItem(clipboardLocalStorageKey, html)]);
  }
};

export const cutToClipboard = async () => {
  try {
    if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;
    debugTimeReset();
    await toClipboardCut();
    debugTimeCheck('cut to clipboard (fallback)');
  } catch (error) {
    clipboardSendAnalyticsError('cutToClipboard', error);
    pixiAppSettings.addGlobalSnackbar?.('Failed to cut to clipboard.', { severity: 'error' });
  }
};

export const copyToClipboard = async () => {
  try {
    debugTimeReset();
    await toClipboardCopy();
    pixiApp.copy.changeCopyRanges();
    debugTimeCheck('copy to clipboard');
  } catch (error) {
    clipboardSendAnalyticsError('copyToClipboard', error);
    pixiAppSettings.addGlobalSnackbar?.('Failed to copy to clipboard.', { severity: 'error' });
  }
};

export const copySelectionToPNG = async () => {
  try {
    if (!fullClipboardSupport()) {
      console.log('copy to PNG is not supported in Firefox (yet)');
      mixpanel.track('[clipboard].copySelectionToPNG.notSupported');
      return;
    }

    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': copyAsPNG()
          .then((results) => {
            if (!results) {
              throw new Error('No PNG data generated');
            }
            return new Blob([results], { type: 'image/png' });
          })
          .catch(() => {
            throw new Error('Failed to copy as PNG');
          }),
      }),
    ]);

    pixiAppSettings.addGlobalSnackbar?.('Copied selection as PNG to clipboard');
  } catch (error) {
    clipboardSendAnalyticsError('copySelectionToPNG', error);
    pixiAppSettings.addGlobalSnackbar?.('Failed to copy selection as PNG.', { severity: 'error' });
  }
};

export const pasteFromClipboard = async (special: PasteSpecial = 'None') => {
  try {
    if (!hasPermissionToEditFile(pixiAppSettings.permissions)) return;

    if (fullClipboardSupport()) {
      const clipboardData = await navigator.clipboard.read();

      // get text/plain if available
      let plainText = '';
      const plainTextItem = clipboardData.find((item) => item.types.includes('text/plain'));
      if (plainTextItem) {
        const item = await plainTextItem.getType('text/plain');
        plainText = await item.text();
      }

      // gets text/html if available
      let html = '';
      const htmlItem = clipboardData.find((item) => item.types.includes('text/html'));
      if (htmlItem) {
        const item = await htmlItem.getType('text/html');
        html = await item.text();
      }

      if (plainText || html) {
        const jsClipboard: JsClipboard = {
          plainText,
          html,
        };
        const jsClipboardUint8Array = toUint8Array(jsClipboard);
        plainText = '';
        html = '';

        quadraticCore.pasteFromClipboard({
          selection: sheets.sheet.cursor.save(),
          jsClipboard: jsClipboardUint8Array,
          special,
        });
      }
    }

    // handles firefox using localStorage :(
    else {
      let html = (await localforage.getItem(clipboardLocalStorageKey)) as string;
      if (html) {
        const jsClipboard: JsClipboard = {
          plainText: '',
          html,
        };
        const jsClipboardUint8Array = toUint8Array(jsClipboard);
        html = '';

        quadraticCore.pasteFromClipboard({
          selection: sheets.sheet.cursor.save(),
          jsClipboard: jsClipboardUint8Array,
          special,
        });
      }
    }
  } catch (error) {
    clipboardSendAnalyticsError('pasteFromClipboard', error);
    pixiAppSettings.addGlobalSnackbar?.('Failed to paste from clipboard.', { severity: 'error' });
  }
};

//#endregion
