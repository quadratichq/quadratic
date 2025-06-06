import { debugShowFileIO, debugStartupTime } from '@/app/debugFlags';
import { events } from '@/app/events/events';
import FontFaceObserver from 'fontfaceobserver';
import { Assets, BitmapFont } from 'pixi.js';
import { createBorderTypes } from './generateTextures';

export const bitmapFonts = ['OpenSans', 'OpenSans-Bold', 'OpenSans-Italic', 'OpenSans-BoldItalic'];

const TIMEOUT = 10000;

function loadFont(fontName: string): void {
  const font = new FontFaceObserver(fontName);
  font.load(undefined, TIMEOUT);
}

export function isBitmapFontLoaded(): boolean {
  return bitmapFonts.every((font) => BitmapFont.available[font]);
}

export async function loadAssets() {
  if (debugStartupTime) console.time('[loadAssets] Loading Bitmap fonts and icons (parallel)');
  if (debugShowFileIO) console.log('[loadAssets] Loading assets...');
  createBorderTypes();

  // Load HTML fonts for Input
  const font1Promise = loadFont('OpenSans');
  const font2Promise = loadFont('OpenSans-Bold');
  const font3Promise = loadFont('OpenSans-Italic');
  const font4Promise = loadFont('OpenSans-BoldItalic');

  // Load PixiJS fonts for canvas
  const bundle = {
    OpenSans: '/fonts/opensans/OpenSans.fnt',
    'OpenSans-Bold': '/fonts/opensans/OpenSans-Bold.fnt',
    'OpenSans-Italic': '/fonts/opensans/OpenSans-Italic.fnt',
    'OpenSans-BoldItalic': '/fonts/opensans/OpenSans-BoldItalic.fnt',

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
  Assets.addBundle('bundle', bundle);
  const bundlePromise = Assets.loadBundle('bundle');

  await Promise.all([font1Promise, font2Promise, font3Promise, font4Promise, bundlePromise]);

  if (debugStartupTime) console.timeEnd('[loadAssets] Loading Bitmap fonts and icons (parallel)');
  events.emit('bitmapFontsLoaded');
}
