use std::str::FromStr;

use bigdecimal::BigDecimal;

use crate::{
    controller::GridController,
    grid::{
        formatting::CellFmtArray, generate_borders, BorderSelection, CodeCellLanguage,
        CodeCellValue, NumericDecimals, NumericFormat, NumericFormatKind,
    },
    util::date_string,
    Array, CellValue, RunLengthEncoding, SheetPos, SheetRect,
};

use super::operation::Operation;

impl GridController {
    pub(super) fn string_to_cell_value(
        &mut self,
        sheet_pos: SheetPos,
        value: &str,
        ops: &mut Vec<Operation>,
    ) -> CellValue {
        let sheet = self.grid.sheet_mut_from_id(sheet_pos.sheet_id);
        let sheet_rect = SheetRect::from(sheet_pos);

        // strip whitespace
        let value = value.trim();

        if value.is_empty() {
            CellValue::Blank
        } else if let Some((currency, number)) = CellValue::unpack_currency(value) {
            let numeric_format = NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some(currency),
            };
            ops.push(Operation::SetCellFormats {
                sheet_rect,
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                    Some(numeric_format),
                    1,
                )),
            });
            // only change decimal places if decimals have not been set
            if sheet
                .get_formatting_value::<NumericDecimals>(sheet_pos.into())
                .is_none()
            {
                ops.push(Operation::SetCellFormats {
                    sheet_rect,
                    attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(Some(2), 1)),
                });
            }
            CellValue::Number(number)
        } else if let Ok(bd) = BigDecimal::from_str(value) {
            CellValue::Number(bd)
        } else if let Some(percent) = CellValue::unpack_percentage(value) {
            let numeric_format = NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            };
            ops.push(Operation::SetCellFormats {
                sheet_rect,
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                    Some(numeric_format),
                    1,
                )),
            });

            CellValue::Number(percent)
        } else {
            CellValue::Text(value.into())
        }
    }

    pub fn set_cell_value_operations(
        &mut self,
        sheet_pos: SheetPos,
        value: String,
    ) -> Vec<Operation> {
        let mut ops = vec![];
        let cell_value = self.string_to_cell_value(sheet_pos, value.as_str(), &mut ops);

        vec![Operation::SetCellValues {
            sheet_rect: sheet_pos.into(),
            values: Array::from(cell_value),
        }]
    }

    pub fn set_cell_code_operations(
        &mut self,
        sheet_pos: SheetPos,
        language: CodeCellLanguage,
        code_string: String,
    ) -> Vec<Operation> {
        let sheet = self.grid.sheet_mut_from_id(sheet_pos.sheet_id);
        let mut ops = vec![];

        // remove any values that were originally over the code cell
        if sheet.get_cell_value_only(sheet_pos.into()).is_some() {
            ops.push(Operation::SetCellValues {
                sheet_rect: SheetRect::from(sheet_pos),
                values: Array::from(CellValue::Blank),
            });
        }

        ops.push(Operation::SetCellCode {
            sheet_pos,
            code_cell_value: Some(CodeCellValue {
                language,
                code_string,
                formatted_code_string: None,
                output: None,
                last_modified: date_string(),
            }),
        });

        ops
    }

    /// Generates and returns the set of operations to deleted the values and code in a given region
    /// Does not commit the operations or create a transaction.
    pub fn delete_cells_rect_operations(&mut self, sheet_rect: SheetRect) -> Vec<Operation> {
        let mut ops = vec![];
        let values = Array::new_empty(sheet_rect.size());
        ops.push(Operation::SetCellValues { sheet_rect, values });

        let sheet = self.grid.sheet_from_id(sheet_rect.sheet_id);

        // collect all the code cells in the region
        for pos in sheet.code_cells.keys() {
            if sheet_rect.contains(pos.to_sheet_pos(sheet_rect.sheet_id)) {
                ops.push(Operation::SetCellCode {
                    sheet_pos: pos.to_sheet_pos(sheet_rect.sheet_id),
                    code_cell_value: None,
                });
            }
        }
        ops
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
        let sheet = self.grid.sheet_from_id(sheet_rect.sheet_id);
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
        ops
    }
}
