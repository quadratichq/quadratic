use super::operation::Operation;
use crate::{
    a1::A1Selection,
    cell_values::CellValues,
    controller::GridController,
    formulas::replace_a1_notation,
    grid::{formats::SheetFormatUpdates, CodeCellLanguage, CodeCellValue, DataTable, SheetId},
    CellValue, SheetPos,
};

impl GridController {
    /// Adds operations to compute a CellValue::Code at the sheet_pos.
    pub fn set_code_cell_operations(
        &self,
        sheet_pos: SheetPos,
        language: CodeCellLanguage,
        code: String,
    ) -> Vec<Operation> {
        let parse_ctx = self.a1_context();
        let code = match language {
            CodeCellLanguage::Formula => replace_a1_notation(&code, parse_ctx, sheet_pos),
            _ => code,
        };

        vec![
            Operation::SetCellValues {
                sheet_pos,
                values: CellValues::from(CellValue::Code(CodeCellValue { language, code })),
            },
            Operation::ComputeCode { sheet_pos },
        ]
    }

    pub fn set_data_table_operations_at(
        &self,
        sheet_pos: SheetPos,
        value: String,
    ) -> Vec<Operation> {
        let mut ops = vec![];

        let Some(sheet) = self.try_sheet(sheet_pos.sheet_id) else {
            return ops;
        };

        let Ok(data_table_pos) = sheet.first_data_table_within(sheet_pos.into()) else {
            return ops;
        };

        let Some(data_table) = sheet.data_table(data_table_pos) else {
            return ops;
        };

        // strip whitespace
        let value = value.trim();

        let (cell_value, format_update) = self.string_to_cell_value(value, false);

        ops.push(Operation::SetDataTableAt {
            sheet_pos,
            values: CellValues::from(cell_value),
        });

        if !format_update.is_default() {
            ops.push(Operation::DataTableFormats {
                sheet_pos: data_table_pos.to_sheet_pos(sheet_pos.sheet_id),
                formats: SheetFormatUpdates::from_selection(
                    &A1Selection::from_xy(
                        sheet_pos.x - data_table_pos.x + 1,
                        sheet_pos.y - data_table_pos.y + 1 - data_table.y_adjustment(true),
                        sheet_pos.sheet_id,
                    ),
                    format_update,
                ),
            });
        }

        ops
    }

    // Returns whether a code_cell is dependent on another code_cell.
    fn is_dependent_on(&self, current: &DataTable, other_pos: SheetPos) -> bool {
        let context = self.a1_context();
        current
            .code_run()
            .map(|code_run| code_run.cells_accessed.contains(other_pos, context))
            .unwrap_or(false)
    }

    /// Orders code cells to ensure earlier computes do not depend on later computes.
    fn order_code_cells(&self, code_cell_positions: &mut Vec<(SheetPos, &DataTable)>) {
        // Change the ordering of code_cell_positions to ensure earlier operations do not depend on later operations.
        //
        // Algorithm: iterate through all code cells and check if they are dependent on later code cells. If they are,
        // move them to the position after the later code cell and restart the iteration. Note: this is different from
        // sorting as we need to compare all code cells against every other code cell to find the ordering.
        let mut protect_infinite = 0;
        let mut i = 0;

        if code_cell_positions.len() <= 1 {
            return;
        }

        loop {
            let current = code_cell_positions[i];
            let mut changed = false;
            for j in (i + 1)..code_cell_positions.len() {
                let other = code_cell_positions[j];
                if self.is_dependent_on(current.1, other.0) {
                    // move the current code cell to the position after the other code cell
                    code_cell_positions.remove(i);

                    // we want to place it after j, but since we removed i, we can use index = j instead of index = j + 1
                    code_cell_positions.insert(j, current);
                    changed = true;
                    break;
                }
            }
            if !changed {
                i += 1;

                // only iterate to the second to last element as the last element will always be in the correct position
                if i == code_cell_positions.len() - 1 {
                    break;
                }
            } else {
                protect_infinite += 1;
                if protect_infinite > 100000 {
                    println!("Infinite loop in order_code_cells");
                    break;
                }
            }
        }
    }

    /// Reruns all code cells in a Sheet.
    pub fn rerun_sheet_code_cells_operations(&self, sheet_id: SheetId) -> Vec<Operation> {
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return vec![];
        };
        let mut code_cell_positions = sheet
            .data_tables
            .iter()
            .map(|(pos, code_run)| (pos.to_sheet_pos(sheet_id), code_run))
            .collect::<Vec<_>>();

        self.order_code_cells(&mut code_cell_positions);

        code_cell_positions
            .iter()
            .map(|(sheet_pos, _)| Operation::ComputeCode {
                sheet_pos: *sheet_pos,
            })
            .collect()
    }

    /// Reruns all code cells in all Sheets.
    pub fn rerun_all_code_cells_operations(&self) -> Vec<Operation> {
        let mut code_cell_positions = self
            .grid()
            .sheets()
            .iter()
            .flat_map(|sheet| {
                sheet
                    .data_tables
                    .iter()
                    .map(|(pos, code_run)| (pos.to_sheet_pos(sheet.id), code_run))
            })
            .collect::<Vec<_>>();

        self.order_code_cells(&mut code_cell_positions);

        code_cell_positions
            .iter()
            .map(|(sheet_pos, _)| Operation::ComputeCode {
                sheet_pos: *sheet_pos,
            })
            .collect()
    }

    /// Reruns a code cell
    pub fn rerun_code_cell_operations(&self, sheet_pos: SheetPos) -> Vec<Operation> {
        vec![Operation::ComputeCode { sheet_pos }]
    }

    pub fn set_chart_size_operations(
        &self,
        sheet_pos: SheetPos,
        pixel_width: f32,
        pixel_height: f32,
    ) -> Vec<Operation> {
        vec![Operation::SetChartSize {
            sheet_pos,
            pixel_width,
            pixel_height,
        }]
    }
}

#[cfg(test)]
mod test {
    use bigdecimal::BigDecimal;

    use super::*;
    use crate::Pos;

    #[test]
    fn test_set_code_cell_operations() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut(sheet_id).unwrap();
        let pos = Pos { x: 0, y: 0 };
        sheet.set_cell_value(pos, CellValue::Text("delete me".to_string()));

        let operations = gc.set_code_cell_operations(
            pos.to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "print('hello world')".to_string(),
        );
        assert_eq!(operations.len(), 2);
        assert_eq!(
            operations[0],
            Operation::SetCellValues {
                sheet_pos: pos.to_sheet_pos(sheet_id),
                values: CellValues::from(CellValue::Code(CodeCellValue {
                    language: CodeCellLanguage::Python,
                    code: "print('hello world')".to_string(),
                })),
            }
        );
        assert_eq!(
            operations[1],
            Operation::ComputeCode {
                sheet_pos: pos.to_sheet_pos(sheet_id),
            }
        );
    }

    #[test]
    fn test_rerun_all_code_cells_operations() {
        let mut gc = GridController::default();
        gc.add_sheet(None);

        // (1, 1) = 1 + 1
        let first = |gc: &mut GridController| {
            let sheet_id = gc.sheet_ids()[0];
            gc.set_code_cell(
                SheetPos {
                    x: 1,
                    y: 1,
                    sheet_id,
                },
                CodeCellLanguage::Formula,
                "1 + 1".to_string(),
                None,
            );
        };

        // (2, 2) = A1
        let second = |gc: &mut GridController| {
            let sheet_id = gc.sheet_ids()[0];
            gc.set_code_cell(
                SheetPos {
                    x: 2,
                    y: 2,
                    sheet_id,
                },
                CodeCellLanguage::Formula,
                "A1".to_string(),
                None,
            );
        };

        // (1, 1, Sheet2) = Sheet1:A1
        let third = |gc: &mut GridController| {
            let sheet_id_2 = gc.sheet_ids()[1];
            gc.set_code_cell(
                SheetPos {
                    x: 1,
                    y: 1,
                    sheet_id: sheet_id_2,
                },
                CodeCellLanguage::Formula,
                "Sheet1!A1".to_string(),
                None,
            );
        };

        let check_operations = |gc: &GridController| {
            let sheet_id = gc.sheet_ids()[0];
            let sheet_id_2 = gc.sheet_ids()[1];
            let operations = gc.rerun_all_code_cells_operations();
            assert_eq!(operations.len(), 3);
            assert_eq!(
                operations[0],
                Operation::ComputeCode {
                    sheet_pos: SheetPos {
                        x: 1,
                        y: 1,
                        sheet_id,
                    },
                }
            );
            assert_eq!(
                operations[1],
                Operation::ComputeCode {
                    sheet_pos: SheetPos {
                        x: 2,
                        y: 2,
                        sheet_id,
                    },
                }
            );
            assert_eq!(
                operations[2],
                Operation::ComputeCode {
                    sheet_pos: SheetPos {
                        x: 1,
                        y: 1,
                        sheet_id: sheet_id_2,
                    },
                }
            );
        };

        first(&mut gc);
        second(&mut gc);
        third(&mut gc);

        // sanity check that everything is set properly
        let sheet_id = gc.sheet_ids()[0];
        let sheet_id_2 = gc.sheet_ids()[1];
        let sheet = gc.sheet(sheet_id);
        let sheet_2 = gc.sheet(sheet_id_2);

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 2 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(
            sheet_2.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );

        check_operations(&gc);

        // test same operations in different orders
        let mut gc = GridController::default();
        gc.add_sheet(None);

        second(&mut gc);
        third(&mut gc);
        first(&mut gc);
        check_operations(&gc);

        // test same operations in different orders
        let mut gc = GridController::default();
        gc.add_sheet(None);
        first(&mut gc);
        third(&mut gc);
        second(&mut gc);
        check_operations(&gc);

        // test same operations in different orders
        let mut gc = GridController::default();
        gc.add_sheet(None);
        third(&mut gc);
        second(&mut gc);
        first(&mut gc);
        check_operations(&gc);

        // test same operations in different orders
        let mut gc = GridController::default();
        gc.add_sheet(None);
        third(&mut gc);
        first(&mut gc);
        second(&mut gc);
        check_operations(&gc);

        let check_sheet_operations = |gc: &GridController| {
            let sheet_id = gc.sheet_ids()[0];
            let operations = gc.rerun_all_code_cells_operations();
            assert_eq!(operations.len(), 2);
            assert_eq!(
                operations[0],
                Operation::ComputeCode {
                    sheet_pos: SheetPos {
                        x: 1,
                        y: 1,
                        sheet_id,
                    },
                }
            );
            assert_eq!(
                operations[1],
                Operation::ComputeCode {
                    sheet_pos: SheetPos {
                        x: 2,
                        y: 2,
                        sheet_id,
                    },
                }
            );
        };

        // test the operations without the second sheet
        let mut gc = GridController::default();
        first(&mut gc);
        second(&mut gc);
        check_sheet_operations(&gc);

        // test same operations in different orders
        let mut gc = GridController::default();
        second(&mut gc);
        first(&mut gc);
        check_sheet_operations(&gc);
    }

    #[test]
    fn rerun_all_code_cells_one() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        };
        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Formula,
            "1 + 1".to_string(),
            None,
        );
        gc.rerun_all_code_cells(None);
        gc.rerun_code_cell(sheet_pos, None);
        gc.rerun_sheet_code_cells(sheet_id, None);
    }
}
