import { debugFlag } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import { createBorderTypes } from '@/app/gridGL/generateTextures';
import FontFaceObserver from 'fontfaceobserver';
import { Assets, BitmapFont } from 'pixi.js';

export const bitmapFonts = ['OpenSans', 'OpenSans-Bold', 'OpenSans-Italic', 'OpenSans-BoldItalic'];

const TIMEOUT = 10000;

let assetsLoaded = false;

async function loadFont(fontName: string): Promise<void> {
  const font = new FontFaceObserver(fontName);
  await font.load(undefined, TIMEOUT);
}

export function isBitmapFontLoaded(): boolean {
  return assetsLoaded && bitmapFonts.every((font) => BitmapFont.available[font]);
}

export async function loadAssets() {
  if (debugFlag('debugStartupTime')) console.time('[loadAssets] Loading Bitmap fonts and icons');
  if (debugFlag('debugShowFileIO')) console.log('[loadAssets] Loading assets...');
  createBorderTypes();

  createBorderTypes();

  // Load PixiJS fonts for canvas
  const bundle = {
    OpenSans: '/fonts/opensans/OpenSans.fnt',
    'OpenSans-Bold': '/fonts/opensans/OpenSans-Bold.fnt',
    'OpenSans-Italic': '/fonts/opensans/OpenSans-Italic.fnt',
    'OpenSans-BoldItalic': '/fonts/opensans/OpenSans-BoldItalic.fnt',

    'icon-formula': '/images/icon-formula.png',
    'icon-python': '/images/icon-python.png',
    'icon-javascript': '/images/icon-javascript.png',
    'icon-connection': '/images/icon-connection.png',

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
  await Assets.loadBundle('bundle');

  // Load HTML fonts for Input
  const openSansPromise = loadFont('OpenSans');
  const openSansBoldPromise = loadFont('OpenSans-Bold');
  const openSansItalicPromise = loadFont('OpenSans-Italic');
  const openSansBoldItalicPromise = loadFont('OpenSans-BoldItalic');
  await Promise.all([openSansPromise, openSansBoldPromise, openSansItalicPromise, openSansBoldItalicPromise]);

  assetsLoaded = true;

  events.emit('bitmapFontsLoaded');

  if (debugFlag('debugStartupTime')) console.timeEnd('[loadAssets] Loading Bitmap fonts and icons');
}
