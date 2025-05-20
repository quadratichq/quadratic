import { debugShowFileIO, debugStartupTime } from '@/app/debugFlags';
import { events } from '@/app/events/events';
import FontFaceObserver from 'fontfaceobserver';
import { Assets } from 'pixi.js';
import { createBorderTypes } from './generateTextures';

export const bitmapFonts = ['OpenSans', 'OpenSans-Bold', 'OpenSans-Italic', 'OpenSans-BoldItalic'];

const TIMEOUT = 10000;

let assetsLoaded = false;

function loadFont(fontName: string): void {
  const font = new FontFaceObserver(fontName);
  font.load(undefined, TIMEOUT);
}

export function isBitmapFontLoaded(): boolean {
  return assetsLoaded;
}

export function loadAssets() {
  if (debugStartupTime) console.time('[loadAssets] Loading Bitmap fonts and icons (parallel)');
  if (debugShowFileIO) console.log('[loadAssets] Loading assets...');
  createBorderTypes();

  // Load HTML fonts for Input
  loadFont('OpenSans');
  loadFont('OpenSans-Bold');
  loadFont('OpenSans-Italic');
  loadFont('OpenSans-BoldItalic');

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
  Assets.loadBundle('bundle').then(() => {
    if (debugStartupTime) console.timeEnd('[loadAssets] Loading Bitmap fonts and icons (parallel)');
    assetsLoaded = true;
    events.emit('bitmapFontsLoaded');
  });
}
