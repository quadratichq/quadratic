use crate::{
    controller::GridController,
    grid::{
        formatting::CellFmtArray, generate_borders, BorderSelection, NumericCommas, NumericFormat,
        NumericFormatKind,
    },
    RunLengthEncoding, SheetPos, SheetRect,
};

use super::operation::Operation;

impl GridController {
    pub fn set_currency_operations(
        &mut self,
        sheet_rect: &SheetRect,
        symbol: Option<String>,
    ) -> Vec<Operation> {
        vec![
            Operation::SetCellFormats {
                sheet_rect: *sheet_rect,
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                    Some(NumericFormat {
                        kind: NumericFormatKind::Currency,
                        symbol,
                    }),
                    sheet_rect.len(),
                )),
            },
            // todo: this should not set the decimals
            // default for currency should be 2 but we should not actually change it
            Operation::SetCellFormats {
                sheet_rect: *sheet_rect,
                attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(
                    Some(2),
                    sheet_rect.len(),
                )),
            },
        ]
    }

    /// Sets NumericFormat and NumericDecimals to None
    pub fn remove_number_formatting_operations(
        &mut self,
        sheet_rect: &SheetRect,
    ) -> Vec<Operation> {
        vec![
            Operation::SetCellFormats {
                sheet_rect: *sheet_rect,
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                    None,
                    sheet_rect.len(),
                )),
            },
            Operation::SetCellFormats {
                sheet_rect: *sheet_rect,
                attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(
                    None,
                    sheet_rect.len(),
                )),
            },
            Operation::SetCellFormats {
                sheet_rect: *sheet_rect,
                attr: CellFmtArray::NumericCommas(RunLengthEncoding::repeat(
                    None,
                    sheet_rect.len(),
                )),
            },
        ]
    }

    pub fn change_decimal_places_operations(
        &mut self,
        source: SheetPos,
        sheet_rect: SheetRect,
        delta: isize,
    ) -> Vec<Operation> {
        let Some(sheet) = self.try_sheet(source.sheet_id) else {
            return vec![];
        };
        let is_percentage =
            sheet.cell_numeric_format_kind(source.into()) == Some(NumericFormatKind::Percentage);
        let decimals = sheet
            .decimal_places(source.into(), is_percentage)
            .unwrap_or(0);
        if decimals + (delta as i16) < 0 {
            return vec![];
        }
        let numeric_decimals = Some(decimals + delta as i16);
        vec![Operation::SetCellFormats {
            sheet_rect,
            attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(
                numeric_decimals,
                sheet_rect.len(),
            )),
        }]
    }

    pub fn toggle_commas_operations(
        &mut self,
        source: SheetPos,
        sheet_rect: SheetRect,
    ) -> Vec<Operation> {
        let Some(sheet) = self.try_sheet(source.sheet_id) else {
            return vec![];
        };
        let commas =
            if let Some(commas) = sheet.get_formatting_value::<NumericCommas>(source.into()) {
                !commas
            } else {
                true
            };
        vec![Operation::SetCellFormats {
            sheet_rect,
            attr: CellFmtArray::NumericCommas(RunLengthEncoding::repeat(
                Some(commas),
                sheet_rect.len(),
            )),
        }]
    }

    pub fn clear_formatting_operations(&mut self, sheet_rect: SheetRect) -> Vec<Operation> {
        let len = sheet_rect.size().len();
        let mut ops = vec![
            Operation::SetCellFormats {
                sheet_rect,
                attr: CellFmtArray::Align(RunLengthEncoding::repeat(None, len)),
            },
            Operation::SetCellFormats {
                sheet_rect,
                attr: CellFmtArray::Wrap(RunLengthEncoding::repeat(None, len)),
            },
            Operation::SetCellFormats {
                sheet_rect,
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(None, len)),
            },
            Operation::SetCellFormats {
                sheet_rect,
                attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(None, len)),
            },
            Operation::SetCellFormats {
                sheet_rect,
                attr: CellFmtArray::Bold(RunLengthEncoding::repeat(None, len)),
            },
            Operation::SetCellFormats {
                sheet_rect,
                attr: CellFmtArray::Italic(RunLengthEncoding::repeat(None, len)),
            },
            Operation::SetCellFormats {
                sheet_rect,
                attr: CellFmtArray::TextColor(RunLengthEncoding::repeat(None, len)),
            },
            Operation::SetCellFormats {
                sheet_rect,
                attr: CellFmtArray::FillColor(RunLengthEncoding::repeat(None, len)),
            },
        ];

        // clear borders
        if let Some(sheet) = self.try_sheet(sheet_rect.sheet_id) {
            let borders = generate_borders(
                sheet,
                &sheet_rect.into(),
                vec![BorderSelection::Clear],
                None,
            );
            ops.push(Operation::SetBorders {
                sheet_rect,
                borders,
            });
        }
        ops
    }
}
