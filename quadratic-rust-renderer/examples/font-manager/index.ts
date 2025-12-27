/**
 * Font Manager Module
 *
 * Exports for font loading and management.
 */

export { FontManager, createStandardFontManager, STANDARD_FONT_VARIANTS } from './font-manager';
export type { FontStyle, FontVariant, FontManagerMessageSender } from './font-manager';

export { parseBMFont, loadFontTextures, loadFont } from './font-loader';
export type { CharData, FontData } from './font-loader';
