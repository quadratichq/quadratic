use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    grid::formatting::CellFmtArray,
    grid::*,
};

impl GridController {
    pub(crate) fn execute_set_cell_formats(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetCellFormats { sheet_rect, attr } = op {
            let old_attr = match attr.clone() {
                CellFmtArray::Align(align) => CellFmtArray::Align(
                    self.set_cell_formats_for_type::<CellAlign>(&sheet_rect, align),
                ),
                CellFmtArray::Wrap(wrap) => CellFmtArray::Wrap(
                    self.set_cell_formats_for_type::<CellWrap>(&sheet_rect, wrap),
                ),
                CellFmtArray::NumericFormat(num_fmt) => CellFmtArray::NumericFormat(
                    self.set_cell_formats_for_type::<NumericFormat>(&sheet_rect, num_fmt),
                ),
                CellFmtArray::NumericDecimals(num_decimals) => CellFmtArray::NumericDecimals(
                    self.set_cell_formats_for_type::<NumericDecimals>(&sheet_rect, num_decimals),
                ),
                CellFmtArray::NumericCommas(num_commas) => CellFmtArray::NumericCommas(
                    self.set_cell_formats_for_type::<NumericCommas>(&sheet_rect, num_commas),
                ),
                CellFmtArray::Bold(bold) => {
                    CellFmtArray::Bold(self.set_cell_formats_for_type::<Bold>(&sheet_rect, bold))
                }
                CellFmtArray::Italic(italic) => CellFmtArray::Italic(
                    self.set_cell_formats_for_type::<Italic>(&sheet_rect, italic),
                ),
                CellFmtArray::TextColor(text_color) => CellFmtArray::TextColor(
                    self.set_cell_formats_for_type::<TextColor>(&sheet_rect, text_color),
                ),
                CellFmtArray::FillColor(fill_color) => CellFmtArray::FillColor(
                    self.set_cell_formats_for_type::<FillColor>(&sheet_rect, fill_color),
                ),
                CellFmtArray::RenderSize(output_size) => CellFmtArray::RenderSize(
                    self.set_cell_formats_for_type::<RenderSize>(&sheet_rect, output_size),
                ),
            };

            if !transaction.is_server() {
                match &attr {
                    CellFmtArray::RenderSize(_) => self.send_html_output_rect(&sheet_rect),
                    CellFmtArray::FillColor(_) => self.send_fill_cells(&sheet_rect),
                    _ => {
                        self.send_updated_bounds_rect(&sheet_rect, true);
                        self.send_render_cells(&sheet_rect);
                    }
                };
            }

            transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_rect(&sheet_rect);

            transaction
                .forward_operations
                .push(Operation::SetCellFormats { sheet_rect, attr });

            transaction.reverse_operations.insert(
                0,
                Operation::SetCellFormats {
                    sheet_rect,
                    attr: old_attr,
                },
            );
        }
    }
}
