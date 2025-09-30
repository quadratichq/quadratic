use crate::grid::file::{
    shift_negative_offsets::add_import_offset_to_contiguous_2d_rect,
    v1_7_1::{
        CellAlignSchema, CellVerticalAlignSchema, CellWrapSchema, NumericFormatSchema,
        RenderSizeSchema, SheetFormattingSchema,
    },
};

use super::{Contiguous2DUpgrade, schema::FormatSchema};

#[derive(Default)]
pub(crate) struct SheetFormattingUpgrade {
    pub(crate) align: Contiguous2DUpgrade<Option<CellAlignSchema>>,
    pub(crate) vertical_align: Contiguous2DUpgrade<Option<CellVerticalAlignSchema>>,
    pub(crate) wrap: Contiguous2DUpgrade<Option<CellWrapSchema>>,
    pub(crate) numeric_format: Contiguous2DUpgrade<Option<NumericFormatSchema>>,
    pub(crate) numeric_decimals: Contiguous2DUpgrade<Option<i16>>,
    pub(crate) numeric_commas: Contiguous2DUpgrade<Option<bool>>,
    pub(crate) bold: Contiguous2DUpgrade<Option<bool>>,
    pub(crate) italic: Contiguous2DUpgrade<Option<bool>>,
    pub(crate) text_color: Contiguous2DUpgrade<Option<String>>,
    pub(crate) fill_color: Contiguous2DUpgrade<Option<String>>,
    pub(crate) render_size: Contiguous2DUpgrade<Option<RenderSizeSchema>>,
    pub(crate) date_time: Contiguous2DUpgrade<Option<String>>,
    pub(crate) underline: Contiguous2DUpgrade<Option<bool>>,
    pub(crate) strike_through: Contiguous2DUpgrade<Option<bool>>,
}

impl SheetFormattingUpgrade {
    pub(crate) fn apply_format(
        &mut self,
        x1: i64,
        y1: i64,
        x2: Option<i64>,
        y2: Option<i64>,
        format: FormatSchema,
    ) {
        let (x1, y1, x2, y2) = add_import_offset_to_contiguous_2d_rect(x1, y1, x2, y2);

        if let Some(align) = format.align {
            self.align.set_rect(x1, y1, x2, y2, Some(align));
        }
        if let Some(vertical_align) = format.vertical_align {
            self.vertical_align
                .set_rect(x1, y1, x2, y2, Some(vertical_align));
        }
        if let Some(wrap) = format.wrap {
            self.wrap.set_rect(x1, y1, x2, y2, Some(wrap));
        }
        if let Some(numeric_format) = format.numeric_format {
            self.numeric_format
                .set_rect(x1, y1, x2, y2, Some(numeric_format));
        }
        if let Some(numeric_decimals) = format.numeric_decimals {
            self.numeric_decimals
                .set_rect(x1, y1, x2, y2, Some(numeric_decimals));
        }
        if let Some(numeric_commas) = format.numeric_commas {
            self.numeric_commas
                .set_rect(x1, y1, x2, y2, Some(numeric_commas));
        }
        if let Some(bold) = format.bold {
            self.bold.set_rect(x1, y1, x2, y2, Some(bold));
        }
        if let Some(italic) = format.italic {
            self.italic.set_rect(x1, y1, x2, y2, Some(italic));
        }
        if let Some(text_color) = format.text_color {
            self.text_color.set_rect(x1, y1, x2, y2, Some(text_color));
        }
        if let Some(fill_color) = format.fill_color {
            self.fill_color.set_rect(x1, y1, x2, y2, Some(fill_color));
        }
        if let Some(render_size) = format.render_size {
            self.render_size.set_rect(x1, y1, x2, y2, Some(render_size));
        }
        if let Some(date_time) = format.date_time {
            self.date_time.set_rect(x1, y1, x2, y2, Some(date_time));
        }
        if let Some(underline) = format.underline {
            self.underline.set_rect(x1, y1, x2, y2, Some(underline));
        }
        if let Some(strike_through) = format.strike_through {
            self.strike_through
                .set_rect(x1, y1, x2, y2, Some(strike_through));
        }
    }

    pub(crate) fn upgrade_schema(self) -> SheetFormattingSchema {
        SheetFormattingSchema {
            align: self.align.upgrade_schema(),
            vertical_align: self.vertical_align.upgrade_schema(),
            wrap: self.wrap.upgrade_schema(),
            numeric_format: self.numeric_format.upgrade_schema(),
            numeric_decimals: self.numeric_decimals.upgrade_schema(),
            numeric_commas: self.numeric_commas.upgrade_schema(),
            bold: self.bold.upgrade_schema(),
            italic: self.italic.upgrade_schema(),
            text_color: self.text_color.upgrade_schema(),
            fill_color: self.fill_color.upgrade_schema(),
            render_size: self.render_size.upgrade_schema(),
            date_time: self.date_time.upgrade_schema(),
            underline: self.underline.upgrade_schema(),
            strike_through: self.strike_through.upgrade_schema(),
        }
    }
}
