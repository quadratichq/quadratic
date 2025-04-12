/* eslint-disable @typescript-eslint/no-unused-vars */
import { debugShowFileIO, debugStartupTime } from '@/app/debugFlags';
import FontFaceObserver from 'fontfaceobserver';
import { Assets, BitmapFont } from 'pixi.js';
import { createBorderTypes } from './generateTextures';

const intervalToCheckBitmapFonts = 100;
export const bitmapFonts = ['OpenSans', 'OpenSans-Bold', 'OpenSans-Italic', 'OpenSans-BoldItalic'];

const TIMEOUT = 10000;

function loadFont(fontName: string): void {
  const font = new FontFaceObserver(fontName);
  font.load(undefined, TIMEOUT);
}

export function isBitmapFontLoaded(): boolean {
  return bitmapFonts.every((font) => BitmapFont.available[font]);
}

function ensureBitmapFontLoaded(resolve: () => void): void {
  const waitForLoad = () => {
    if (bitmapFonts.find((font) => !BitmapFont.available[font])) {
      setTimeout(waitForLoad, intervalToCheckBitmapFonts);
    } else {
      if (debugShowFileIO) console.log('[pixiApp] assets loaded.');
      resolve();
      if (debugStartupTime) console.timeEnd('loading assets...');
    }
  };

  waitForLoad();
}

export function loadAssets(): Promise<void> {
  if (debugStartupTime) console.time('loading assets...');
  return new Promise(async (resolve) => {
    if (debugShowFileIO) console.log('[pixiApp] Loading assets...');
    createBorderTypes();

    // Load HTML fonts for Input
    loadFont('OpenSans');
    loadFont('OpenSans-Bold');
    loadFont('OpenSans-Italic');
    loadFont('OpenSans-BoldItalic');

    // Load PixiJS fonts for canvas
    const fontBundle = {
      OpenSans: '/fonts/opensans/OpenSans.fnt',
      'OpenSans-Bold': '/fonts/opensans/OpenSans-Bold.fnt',
      'OpenSans-Italic': '/fonts/opensans/OpenSans-Italic.fnt',
      'OpenSans-BoldItalic': '/fonts/opensans/OpenSans-BoldItalic.fnt',
    };

    const iconBundle = {
      'icon-formula': '/images/icon-formula.png',
      'icon-python': '/images/icon-python.png',
      'icon-javascript': '/images/icon-javascript.png',
      'icon-postgres': '/images/icon-postgres.png',
      'icon-mysql': '/images/icon-mysql.png',
      'icon-snowflake': '/images/icon-snowflake.png',
      'icon-mssql': '/images/icon-mssql.png',
      'checkbox-icon': '/images/checkbox.png',
      'checkbox-checked-icon': '/images/checkbox-checked.png',
      'dropdown-icon': '/images/dropdown.png',
      'dropdown-white-icon': '/images/dropdown-white.png',
      'chart-placeholder': '/images/chart-placeholder.png',
      'sort-ascending': '/images/sort-ascending.svg',
      'sort-descending': '/images/sort-descending.svg',
    };

    // Add bundles to Assets
    Assets.addBundle('fonts', fontBundle);
    Assets.loadBundle('fonts');

    Assets.addBundle('icons', iconBundle);
    Assets.loadBundle('icons');

    // ensureBitmapFontLoaded(resolve);
    resolve();
  });
}
