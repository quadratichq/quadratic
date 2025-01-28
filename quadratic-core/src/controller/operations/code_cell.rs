use super::operation::Operation;
use crate::{
    cell_values::CellValues,
    controller::GridController,
    formulas::replace_a1_notation,
    grid::{CodeCellLanguage, CodeCellValue, DataTable, SheetId},
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
        let code = match language {
            CodeCellLanguage::Formula => replace_a1_notation(&code, sheet_pos.into()),
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
        values: String,
    ) -> Vec<Operation> {
        let (_, cell_value) = self.string_to_cell_value(sheet_pos, &values);
        let values = CellValues::from(cell_value);

        vec![Operation::SetDataTableAt { sheet_pos, values }]
    }

    // Returns whether a code_cell is dependent on another code_cell.
    fn is_dependent_on(&self, current: &DataTable, other_pos: SheetPos) -> bool {
        let context = self.grid.a1_context();
        current
            .code_run()
            .map(|code_run| code_run.cells_accessed.contains(other_pos, &context))
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
        width: f32,
        height: f32,
    ) -> Vec<Operation> {
        vec![Operation::SetChartSize {
            sheet_pos,
            pixel_width: width,
            pixel_height: height,
        }]
    }

    /// Creates operations if changes to the column width would affect the chart
    /// size.
    pub fn check_chart_size_column_change(&self, sheet_id: SheetId, column: i64) -> Vec<Operation> {
        let mut ops = vec![];
        if let Some(sheet) = self.try_sheet(sheet_id) {
            sheet.data_tables.iter().for_each(|(pos, dt)| {
                if let (Some((width, _)), Some((pixel_width, pixel_height))) =
                    (dt.chart_output, dt.chart_pixel_output)
                {
                    if column >= pos.x && column < pos.x + width as i64 {
                        ops.push(Operation::SetChartSize {
                            sheet_pos: pos.to_sheet_pos(sheet_id),
                            pixel_width,
                            pixel_height,
                        });
                    }
                }
            });
        }
        ops
    }

    /// Creates operations if changes to the row height would affect the chart
    /// size.
    pub fn check_chart_size_row_change(&self, sheet_id: SheetId, row: i64) -> Vec<Operation> {
        let mut ops = vec![];
        if let Some(sheet) = self.try_sheet(sheet_id) {
            sheet.data_tables.iter().for_each(|(pos, dt)| {
                if let (Some((_, height)), Some((pixel_width, pixel_height))) =
                    (dt.chart_output, dt.chart_pixel_output)
                {
                    if row >= pos.y && row < pos.y + height as i64 {
                        ops.push(Operation::SetChartSize {
                            sheet_pos: pos.to_sheet_pos(sheet_id),
                            pixel_width,
                            pixel_height,
                        });
                    }
                }
            });
        }
        ops
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod test {
    use bigdecimal::BigDecimal;

    use super::*;
    use crate::{
        grid::{CodeRun, DataTableKind},
        Pos, Value,
    };
    use serial_test::parallel;

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
                "'Sheet1'!A1".to_string(),
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

    #[test]
    #[parallel]
    fn test_check_chart_size_changes() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let pos = Pos { x: 1, y: 1 };
        let sheet_pos = pos.to_sheet_pos(sheet_id);

        // Set up a data table with chart output
        let mut dt = DataTable::new(
            DataTableKind::CodeRun(CodeRun::default()),
            "Table",
            Value::Single(CellValue::Image("image".to_string())),
            false,
            false,
            true,
            None,
        );
        dt.chart_output = Some((2, 3));
        dt.chart_pixel_output = Some((100.0, 150.0));
        gc.grid_mut()
            .try_sheet_mut(sheet_id)
            .unwrap()
            .data_tables
            .insert(pos, dt);

        // Test column changes
        let ops = gc.check_chart_size_column_change(sheet_id, 1);
        assert_eq!(ops.len(), 1);
        assert_eq!(
            ops[0],
            Operation::SetChartSize {
                sheet_pos,
                pixel_width: 100.0,
                pixel_height: 150.0,
            }
        );

        let ops = gc.check_chart_size_column_change(sheet_id, 2); // Change within chart
        assert_eq!(ops.len(), 1);

        let ops = gc.check_chart_size_column_change(sheet_id, 0); // Change before chart
        assert_eq!(ops.len(), 0);

        let ops = gc.check_chart_size_column_change(sheet_id, 4); // Change after chart
        assert_eq!(ops.len(), 0);

        // Test row changes
        let ops = gc.check_chart_size_row_change(sheet_id, 1); // Change at start of chart
        assert_eq!(ops.len(), 1);
        assert_eq!(
            ops[0],
            Operation::SetChartSize {
                sheet_pos,
                pixel_width: 100.0,
                pixel_height: 150.0,
            }
        );

        let ops = gc.check_chart_size_row_change(sheet_id, 2); // Change within chart
        assert_eq!(ops.len(), 1);

        let ops = gc.check_chart_size_row_change(sheet_id, 0); // Change before chart
        assert_eq!(ops.len(), 0);

        let ops = gc.check_chart_size_row_change(sheet_id, 5); // Change after chart
        assert_eq!(ops.len(), 0);
    }
}
