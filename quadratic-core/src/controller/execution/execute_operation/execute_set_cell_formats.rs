use crate::{
    controller::{operations::operation::Operation, GridController},
    grid::formatting::CellFmtArray,
    grid::*,
};

impl GridController {
    pub(crate) fn execute_set_cell_formats(&mut self, op: &Operation) {
        match op.clone() {
            Operation::SetCellFormats { sheet_rect, attr } => {
                self.sheets_with_dirty_bounds.insert(sheet_rect.sheet_id);

                if let CellFmtArray::FillColor(_) = attr {
                    self.summary.fill_sheets_modified.push(sheet_rect.sheet_id);
                }

                // todo: this is too slow -- perhaps call this again when we have a better way of setting multiple formats within an array
                // or when we get rid of CellRefs (which I think is the reason this is slow)
                // summary.generate_thumbnail =
                //     summary.generate_thumbnail || self.thumbnail_dirty_region(region.clone());

                let old_attr = match attr.clone() {
                    CellFmtArray::Align(align) => CellFmtArray::Align(
                        self.set_cell_formats_for_type::<CellAlign>(&sheet_rect, align, true),
                    ),
                    CellFmtArray::Wrap(wrap) => CellFmtArray::Wrap(
                        self.set_cell_formats_for_type::<CellWrap>(&sheet_rect, wrap, true),
                    ),
                    CellFmtArray::NumericFormat(num_fmt) => CellFmtArray::NumericFormat(
                        self.set_cell_formats_for_type::<NumericFormat>(&sheet_rect, num_fmt, true),
                    ),
                    CellFmtArray::NumericDecimals(num_decimals) => CellFmtArray::NumericDecimals(
                        self.set_cell_formats_for_type::<NumericDecimals>(
                            &sheet_rect,
                            num_decimals,
                            true,
                        ),
                    ),
                    CellFmtArray::NumericCommas(num_commas) => CellFmtArray::NumericCommas(
                        self.set_cell_formats_for_type::<NumericCommas>(
                            &sheet_rect,
                            num_commas,
                            true,
                        ),
                    ),
                    CellFmtArray::Bold(bold) => CellFmtArray::Bold(
                        self.set_cell_formats_for_type::<Bold>(&sheet_rect, bold, true),
                    ),
                    CellFmtArray::Italic(italic) => CellFmtArray::Italic(
                        self.set_cell_formats_for_type::<Italic>(&sheet_rect, italic, true),
                    ),
                    CellFmtArray::TextColor(text_color) => CellFmtArray::TextColor(
                        self.set_cell_formats_for_type::<TextColor>(&sheet_rect, text_color, true),
                    ),
                    CellFmtArray::FillColor(fill_color) => {
                        self.summary.fill_sheets_modified.push(sheet_rect.sheet_id);
                        CellFmtArray::FillColor(self.set_cell_formats_for_type::<FillColor>(
                            &sheet_rect,
                            fill_color,
                            false,
                        ))
                    }
                    CellFmtArray::RenderSize(output_size) => {
                        self.summary.html.insert(sheet_rect.sheet_id);
                        CellFmtArray::RenderSize(self.set_cell_formats_for_type::<RenderSize>(
                            &sheet_rect,
                            output_size,
                            false,
                        ))
                    }
                };

                self.forward_operations
                    .push(Operation::SetCellFormats { sheet_rect, attr });

                self.reverse_operations.insert(
                    0,
                    Operation::SetCellFormats {
                        sheet_rect,
                        attr: old_attr,
                    },
                );
            }
            _ => unreachable!("Expected Operation::SetCellFormats"),
        }
    }
}
