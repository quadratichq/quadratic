use std::str::FromStr;

use bigdecimal::BigDecimal;

use crate::{
    controller::GridController,
    grid::{formatting::CellFmtArray, NumericDecimals, NumericFormat, NumericFormatKind},
    Array, CellValue, RunLengthEncoding, SheetPos, SheetRect,
};

use super::operation::Operation;

impl GridController {
    /// Convert string to a cell_value and generate necessary operations
    pub(super) fn string_to_cell_value(
        &mut self,
        sheet_pos: SheetPos,
        value: &str,
    ) -> (Vec<Operation>, CellValue) {
        let mut ops = vec![];
        let sheet_rect: SheetRect = sheet_pos.into();
        let cell_value = if value.is_empty() {
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
            if let Some(sheet) = self.try_sheet(sheet_pos.sheet_id) {
                if sheet
                    .get_formatting_value::<NumericDecimals>(sheet_pos.into())
                    .is_none()
                {
                    ops.push(Operation::SetCellFormats {
                        sheet_rect,
                        attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(Some(2), 1)),
                    });
                }
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
        };
        (ops, cell_value)
    }

    /// Generate operations for a user-initiated change to a cell value
    pub fn set_cell_value_operations(
        &mut self,
        sheet_pos: SheetPos,
        value: String,
    ) -> Vec<Operation> {
        let mut ops = vec![];

        // strip whitespace
        let value = value.trim();

        // convert the string to a cell value and generate necessary operations
        let (operations, cell_value) = self.string_to_cell_value(sheet_pos, value);
        ops.extend(operations);

        let sheet_rect = sheet_pos.into();
        ops.push(Operation::SetCellValues {
            sheet_rect,
            values: Array::from(cell_value),
        });
        ops
    }

    /// Generates and returns the set of operations to delete the values and code in a sheet_rect
    /// Does not commit the operations or create a transaction.
    pub fn delete_cells_rect_operations(&mut self, sheet_rect: SheetRect) -> Vec<Operation> {
        let values = Array::new_empty(sheet_rect.size());
        vec![Operation::SetCellValues { sheet_rect, values }]
    }

    /// Generates and returns the set of operations to clear the formatting in a sheet_rect
    pub fn delete_values_and_formatting_operations(
        &mut self,
        sheet_rect: SheetRect,
    ) -> Vec<Operation> {
        let mut ops = self.delete_cells_rect_operations(sheet_rect);
        ops.extend(self.clear_formatting_operations(sheet_rect));
        ops
    }
}

#[cfg(test)]
mod test {
    use crate::{controller::GridController, grid::SheetId, SheetPos};

    #[test]
    fn test() {
        let mut client = GridController::test();
        let sheet_id = SheetId::test();
        client.sheet_mut(client.sheet_ids()[0]).id = sheet_id;
        let summary = client.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "hello".to_string(),
            None,
        );
        assert_eq!(summary.operations, Some("[{\"SetCellValues\":{\"sheet_rect\":{\"min\":{\"x\":1,\"y\":2},\"max\":{\"x\":1,\"y\":2},\"sheet_id\":{\"id\":\"00000000-0000-0000-0000-000000000000\"}},\"values\":{\"size\":{\"w\":1,\"h\":1},\"values\":[{\"type\":\"text\",\"value\":\"hello\"}]}}}]".to_string()));
    }
}
