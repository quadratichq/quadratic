import { debugFlag } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import { createBorderTypes } from '@/app/gridGL/generateTextures';
import { emojis } from '@/app/gridGL/pixiApp/emojis/emojis';
import { FONT_VERSION } from '@/shared/constants/appConstants';
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
  if (assetsLoaded) return;
  if (debugFlag('debugShowFileIO')) console.log('[loadAssets] Loading assets...');
  createBorderTypes();

  // Load PixiJS fonts for canvas
  const fontVersion = FONT_VERSION ? `?v=${FONT_VERSION}` : '';
  const fontBundle = {
    OpenSans: `/fonts/opensans/OpenSans.fnt${fontVersion}`,
    'OpenSans-Bold': `/fonts/opensans/OpenSans-Bold.fnt${fontVersion}`,
    'OpenSans-Italic': `/fonts/opensans/OpenSans-Italic.fnt${fontVersion}`,
    'OpenSans-BoldItalic': `/fonts/opensans/OpenSans-BoldItalic.fnt${fontVersion}`,
  };
  // Add bundles to Assets
  Assets.addBundle('fontBundle', fontBundle);

  const iconBundle = {
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
  Assets.addBundle('iconBundle', iconBundle);

  // Load HTML fonts for Input
  const openSansPromise = loadFont('OpenSans');
  const openSansBoldPromise = loadFont('OpenSans-Bold');
  const openSansItalicPromise = loadFont('OpenSans-Italic');
  const openSansBoldItalicPromise = loadFont('OpenSans-BoldItalic');
  await Promise.all([
    openSansPromise,
    openSansBoldPromise,
    openSansItalicPromise,
    openSansBoldItalicPromise,
    Assets.loadBundle('fontBundle'),
    Assets.loadBundle('iconBundle'),
    emojis.preload(),
  ]);

  assetsLoaded = true;

  events.emit('bitmapFontsLoaded');
}
