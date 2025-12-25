import type { JsCoordinate } from '@/app/quadratic-core-types';
import type { Rectangle } from 'pixi.js';

export interface Link {
  pos: JsCoordinate;
  textRectangle: Rectangle;
  /** The hyperlink URL for RichText hyperlinks. If undefined, the cell's display value is the URL. */
  url?: string;
  /** The text of the hyperlink span. */
  linkText?: string;
}

/** A hyperlink span within a cell, with character range and URL. */
export interface LinkSpan {
  /** Start character index (inclusive). */
  start: number;
  /** End character index (exclusive). */
  end: number;
  /** The hyperlink URL. */
  url: string;
  /** Pixel rectangle for this span (calculated after text layout). */
  textRectangle?: Rectangle;
}
