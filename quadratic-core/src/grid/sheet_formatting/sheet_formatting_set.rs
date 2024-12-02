use super::*;

impl SheetFormatting {
    pub fn set_align(
        &mut self,
        x0: i64,
        y0: i64,
        x1: Option<i64>,
        y1: Option<i64>,
        value: Option<CellAlign>,
    ) -> Contiguous2D<Option<CellAlign>> {
        self.align.set_rect(x0, y0, x1, y1, value)
    }

    pub fn set_vertical_align(
        &mut self,
        x0: i64,
        y0: i64,
        x1: Option<i64>,
        y1: Option<i64>,
        value: Option<CellVerticalAlign>,
    ) -> Contiguous2D<Option<CellVerticalAlign>> {
        self.vertical_align.set_rect(x0, y0, x1, y1, value)
    }

    pub fn set_wrap(
        &mut self,
        x0: i64,
        y0: i64,
        x1: Option<i64>,
        y1: Option<i64>,
        value: Option<CellWrap>,
    ) -> Contiguous2D<Option<CellWrap>> {
        self.wrap.set_rect(x0, y0, x1, y1, value)
    }

    pub fn set_numeric_format(
        &mut self,
        x0: i64,
        y0: i64,
        x1: Option<i64>,
        y1: Option<i64>,
        value: Option<NumericFormat>,
    ) -> Contiguous2D<Option<NumericFormat>> {
        self.numeric_format.set_rect(x0, y0, x1, y1, value)
    }

    pub fn set_numeric_decimals(
        &mut self,
        x0: i64,
        y0: i64,
        x1: Option<i64>,
        y1: Option<i64>,
        value: Option<i16>,
    ) -> Contiguous2D<Option<i16>> {
        self.numeric_decimals.set_rect(x0, y0, x1, y1, value)
    }

    pub fn set_numeric_commas(
        &mut self,
        x0: i64,
        y0: i64,
        x1: Option<i64>,
        y1: Option<i64>,
        value: Option<bool>,
    ) -> Contiguous2D<Option<bool>> {
        self.numeric_commas.set_rect(x0, y0, x1, y1, value)
    }

    pub fn set_bold(
        &mut self,
        x0: i64,
        y0: i64,
        x1: Option<i64>,
        y1: Option<i64>,
        value: Option<bool>,
    ) -> Contiguous2D<Option<bool>> {
        self.bold.set_rect(x0, y0, x1, y1, value)
    }

    pub fn set_italic(
        &mut self,
        x0: i64,
        y0: i64,
        x1: Option<i64>,
        y1: Option<i64>,
        value: Option<bool>,
    ) -> Contiguous2D<Option<bool>> {
        self.italic.set_rect(x0, y0, x1, y1, value)
    }

    pub fn set_text_color(
        &mut self,
        x0: i64,
        y0: i64,
        x1: Option<i64>,
        y1: Option<i64>,
        value: Option<String>,
    ) -> Contiguous2D<Option<String>> {
        self.text_color.set_rect(x0, y0, x1, y1, value)
    }

    pub fn set_fill_color(
        &mut self,
        x0: i64,
        y0: i64,
        x1: Option<i64>,
        y1: Option<i64>,
        value: Option<String>,
    ) -> Contiguous2D<Option<String>> {
        self.fill_color.set_rect(x0, y0, x1, y1, value)
    }

    pub fn set_render_size(
        &mut self,
        x0: i64,
        y0: i64,
        x1: Option<i64>,
        y1: Option<i64>,
        value: Option<RenderSize>,
    ) -> Contiguous2D<Option<RenderSize>> {
        self.render_size.set_rect(x0, y0, x1, y1, value)
    }

    pub fn set_date_time(
        &mut self,
        x0: i64,
        y0: i64,
        x1: Option<i64>,
        y1: Option<i64>,
        value: Option<String>,
    ) -> Contiguous2D<Option<String>> {
        self.date_time.set_rect(x0, y0, x1, y1, value)
    }

    pub fn set_underline(
        &mut self,
        x0: i64,
        y0: i64,
        x1: Option<i64>,
        y1: Option<i64>,
        value: Option<bool>,
    ) -> Contiguous2D<Option<bool>> {
        self.underline.set_rect(x0, y0, x1, y1, value)
    }

    pub fn set_strike_through(
        &mut self,
        x0: i64,
        y0: i64,
        x1: Option<i64>,
        y1: Option<i64>,
        value: Option<bool>,
    ) -> Contiguous2D<Option<bool>> {
        self.strike_through.set_rect(x0, y0, x1, y1, value)
    }
}
