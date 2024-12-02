use super::operation::Operation;
use crate::controller::GridController;
use crate::grid::formatting::CellFmtArray;
use crate::grid::{NumericFormat, NumericFormatKind};
use crate::{RunLengthEncoding, SheetPos, SheetRect};

impl GridController {
    pub fn set_currency_operations(
        &mut self,
        sheet_rect: &SheetRect,
        symbol: Option<String>,
    ) -> Vec<Operation> {
        vec![Operation::SetCellFormats {
            sheet_rect: *sheet_rect,
            attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                Some(NumericFormat {
                    kind: NumericFormatKind::Currency,
                    symbol,
                }),
                sheet_rect.len(),
            )),
        }]
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
        let kind = sheet.cell_numeric_format_kind(source.into());
        let source_decimals = sheet
            .calculate_decimal_places(source.into(), kind)
            .unwrap_or(0);
        let new_precision = i16::max(0, source_decimals + (delta as i16));
        vec![Operation::SetCellFormats {
            sheet_rect,
            attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(
                Some(new_precision),
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
        let commas = if let Some(commas) = sheet.formats.numeric_commas.get(source.into()) {
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
}
