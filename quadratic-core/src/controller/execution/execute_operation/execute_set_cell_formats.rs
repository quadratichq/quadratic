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
            transaction
                .sheets_with_dirty_bounds
                .insert(sheet_rect.sheet_id);

            if !matches!(attr, CellFmtArray::RenderSize(_))
                && !matches!(attr, CellFmtArray::FillColor(_))
            {
                transaction
                    .summary
                    .add_cell_sheets_modified_rect(&sheet_rect);
            }

            if matches!(attr, CellFmtArray::FillColor(_)) {
                transaction
                    .summary
                    .fill_sheets_modified
                    .insert(sheet_rect.sheet_id);
            }

            // todo: this is too slow -- perhaps call this again when we have a better way of setting multiple formats within an array
            // or when we get rid of CellRefs (which I think is the reason this is slow)
            // summary.generate_thumbnail =
            //     summary.generate_thumbnail || self.thumbnail_dirty_region(region.clone());

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
                CellFmtArray::FillColor(fill_color) => {
                    transaction
                        .summary
                        .fill_sheets_modified
                        .insert(sheet_rect.sheet_id);
                    CellFmtArray::FillColor(
                        self.set_cell_formats_for_type::<FillColor>(&sheet_rect, fill_color),
                    )
                }
                CellFmtArray::RenderSize(output_size) => {
                    transaction.summary.html.insert(sheet_rect.sheet_id);
                    CellFmtArray::RenderSize(
                        self.set_cell_formats_for_type::<RenderSize>(&sheet_rect, output_size),
                    )
                }
            };

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
