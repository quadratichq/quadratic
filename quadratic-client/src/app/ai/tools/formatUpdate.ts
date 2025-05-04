import type { FormatUpdate } from '@/app/quadratic-core-types';

export const defaultFormatUpdate = (): FormatUpdate => {
  return {
    bold: null,
    italic: null,
    underline: null,
    strike_through: null,
    align: null,
    vertical_align: null,
    wrap: null,
    numeric_format: null,
    numeric_decimals: null,
    numeric_commas: null,
    text_color: null,
    fill_color: null,
    render_size: null,
    date_time: null,
  };
};
