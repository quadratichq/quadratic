use std::collections::HashSet;

use super::operation::Operation;
use crate::{
    CellValue, SheetPos, Value,
    a1::A1Selection,
    controller::GridController,
    formulas::convert_rc_to_a1,
    grid::{
        CellsAccessed, CodeCellLanguage, CodeRun, DataTable, DataTableKind, SheetId,
        js_types::JsSnackbarSeverity, unique_data_table_name,
    },
    util::now,
};

impl GridController {
    /// Adds operations to compute a CellValue::Code at the sheet_pos.
    pub fn set_code_cell_operations(
        &self,
        sheet_pos: SheetPos,
        language: CodeCellLanguage,
        code: String,
        code_cell_name: Option<String>,
    ) -> Vec<Operation> {
        let parse_ctx = self.a1_context();
        let code = match language {
            CodeCellLanguage::Formula => convert_rc_to_a1(&code, parse_ctx, sheet_pos),
            _ => code,
        };

        let Some(sheet) = self.try_sheet(sheet_pos.sheet_id) else {
            // sheet may have been deleted in a multiplayer operation
            return vec![];
        };
        if sheet
            .data_table_pos_that_contains(sheet_pos.into())
            .is_some_and(|dt_pos| dt_pos != sheet_pos.into())
        {
            if cfg!(target_family = "wasm") || cfg!(test) {
                crate::wasm_bindings::js::jsClientMessage(
                    "Cannot add code cell to table".to_string(),
                    JsSnackbarSeverity::Error.to_string(),
                );
            }
            // cannot set a code cell where there is already a data table anchor
            return vec![];
        }

        let existing_data_table = sheet.data_table_full_at(&sheet_pos.into());

        let name = if let Some((_, dt)) = existing_data_table {
            dt.name.clone()
        } else if let Some(code_cell_name) = code_cell_name {
            unique_data_table_name(&code_cell_name, false, Some(sheet_pos), &self.a1_context).into()
        } else {
            let language_str = match language {
                CodeCellLanguage::Formula => "Formula".to_string(),
                CodeCellLanguage::Python => "Python".to_string(),
                CodeCellLanguage::Javascript => "Javascript".to_string(),
                CodeCellLanguage::Import => "Table".to_string(),
                CodeCellLanguage::Connection { kind, .. } => kind.to_string(),
            };
            unique_data_table_name(&language_str, true, Some(sheet_pos), &self.a1_context).into()
        };

        let mut ops = vec![];
        if let Some((existing_data_table_index, existing_data_table)) = existing_data_table
            && let DataTableKind::CodeRun(existing_code_run) = &existing_data_table.kind
            && existing_code_run.language == language
        {
            ops.push(Operation::AddDataTableWithoutCellValue {
                sheet_pos,
                data_table: DataTable {
                    kind: DataTableKind::CodeRun(CodeRun {
                        language,
                        code,
                        ..existing_code_run.clone()
                    }),
                    ..existing_data_table.clone()
                },
                index: existing_data_table_index,
            });
        } else {
            ops.push(Operation::AddDataTableWithoutCellValue {
                sheet_pos,
                data_table: DataTable {
                    kind: DataTableKind::CodeRun(CodeRun {
                        language,
                        code,
                        std_out: None,
                        std_err: None,
                        cells_accessed: CellsAccessed::default(),
                        error: None,
                        return_type: None,
                        line_number: None,
                        output_type: None,
                    }),
                    name,
                    header_is_first_row: false,
                    show_name: None,
                    show_columns: None,
                    column_headers: None,
                    sort: None,
                    sort_dirty: false,
                    display_buffer: None,
                    value: Value::Single(CellValue::Blank),
                    spill_value: false,
                    spill_data_table: false,
                    last_modified: now(),
                    alternating_colors: true,
                    formats: None,
                    borders: None,
                    chart_pixel_output: None,
                    chart_output: None,
                },
                index: usize::MAX,
            });
        }

        ops.push(Operation::ComputeCode { sheet_pos });
        ops
    }

    /// Reruns a code cell
    pub fn rerun_code_cell_operations(&self, selection: A1Selection) -> Vec<Operation> {
        let mut ops = vec![];

        let sheet_id = selection.sheet_id;
        if let Some(sheet) = self.try_sheet(sheet_id) {
            let rects = sheet.selection_to_rects(&selection, false, false, true, self.a1_context());
            rects.iter().for_each(|rect| {
                sheet
                    .data_tables
                    .get_code_runs_in_rect(*rect, false)
                    .for_each(|(_, pos, _)| {
                        ops.push(Operation::ComputeCode {
                            sheet_pos: pos.to_sheet_pos(sheet_id),
                        });
                    });
            });
        }

        ops
    }

    pub fn set_chart_size_operations(&self, sheet_pos: SheetPos, w: u32, h: u32) -> Vec<Operation> {
        vec![Operation::SetChartCellSize { sheet_pos, w, h }]
    }

    /// Reruns all code cells in all Sheets.
    pub fn rerun_all_code_cells_operations(&self) -> Vec<Operation> {
        let mut code_cell_positions = Vec::new();
        for (sheet_id, sheet) in self.grid().sheets() {
            for (pos, _) in sheet.data_tables.expensive_iter_code_runs() {
                code_cell_positions.push(pos.to_sheet_pos(*sheet_id));
            }
        }

        self.get_code_run_ops_from_positions(code_cell_positions)
    }

    /// Reruns all code cells in a Sheet.
    pub fn rerun_sheet_code_cells_operations(&self, sheet_id: SheetId) -> Vec<Operation> {
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return vec![];
        };
        let mut code_cell_positions = Vec::new();
        for (pos, _) in sheet.data_tables.expensive_iter_code_runs() {
            code_cell_positions.push(pos.to_sheet_pos(sheet_id));
        }

        self.get_code_run_ops_from_positions(code_cell_positions)
    }

    fn get_code_run_ops_from_positions(
        &self,
        code_cell_positions: Vec<SheetPos>,
    ) -> Vec<Operation> {
        let code_cell_positions = self.order_code_cells(code_cell_positions);
        code_cell_positions
            .into_iter()
            .map(|sheet_pos| Operation::ComputeCode { sheet_pos })
            .collect()
    }

    /// Orders code cells to ensure earlier computes do not depend on later computes.
    fn order_code_cells(&self, code_cell_positions: Vec<SheetPos>) -> Vec<SheetPos> {
        let mut ordered_positions = vec![];

        let nodes = code_cell_positions.iter().collect::<HashSet<_>>();
        let mut seen = HashSet::new();
        for node in code_cell_positions.iter() {
            for upstream_node in self.get_upstream_dependents(node, &mut seen).into_iter() {
                if nodes.contains(&upstream_node) {
                    ordered_positions.push(upstream_node);
                }
            }
        }

        ordered_positions
    }

    fn get_upstream_dependents(
        &self,
        sheet_pos: &SheetPos,
        seen: &mut HashSet<SheetPos>,
    ) -> Vec<SheetPos> {
        if !seen.insert(*sheet_pos) {
            return vec![];
        }

        let Some(code_run) = self.code_run_at(sheet_pos) else {
            return vec![];
        };

        let mut parent_nodes = Vec::new();
        for (sheet_id, rect) in code_run
            .cells_accessed
            .iter_rects_unbounded(&self.a1_context)
        {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                for (_, pos, _) in sheet.data_tables.get_code_runs_in_sorted(rect, false) {
                    let sheet_pos = pos.to_sheet_pos(sheet_id);
                    if !seen.contains(&sheet_pos) {
                        parent_nodes.push(sheet_pos);
                    }
                }
            }
        }

        let mut upstream = vec![];
        for node in parent_nodes.into_iter() {
            upstream.extend(self.get_upstream_dependents(&node, seen));
        }
        upstream.push(*sheet_pos);
        upstream
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{Pos, constants::SHEET_NAME};

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
            None,
        );
        assert_eq!(operations.len(), 2);
        let Operation::AddDataTableWithoutCellValue { data_table, .. } = &operations[0] else {
            panic!("Expected AddDataTableWithoutCellValue");
        };
        assert_eq!(
            data_table.kind,
            DataTableKind::CodeRun(CodeRun {
                language: CodeCellLanguage::Python,
                code: "print('hello world')".to_string(),
                ..Default::default()
            })
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
        gc.add_sheet(None, None, None, false);

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
                None,
                false,
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
                None,
                false,
            );
        };

        // (1, 1, Sheet 2) = Sheet1:A1
        let third = |gc: &mut GridController| {
            let sheet_id_2 = gc.sheet_ids()[1];
            gc.set_code_cell(
                SheetPos {
                    x: 1,
                    y: 1,
                    sheet_id: sheet_id_2,
                },
                CodeCellLanguage::Formula,
                format!("'{}1'!A1", SHEET_NAME.to_owned()),
                None,
                None,
                false,
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
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 2 }),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet_2.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(2.into()))
        );

        check_operations(&gc);

        // test same operations in different orders
        let mut gc = GridController::default();
        gc.add_sheet(None, None, None, false);

        second(&mut gc);
        third(&mut gc);
        first(&mut gc);
        check_operations(&gc);

        // test same operations in different orders
        let mut gc = GridController::default();
        gc.add_sheet(None, None, None, false);
        first(&mut gc);
        third(&mut gc);
        second(&mut gc);
        check_operations(&gc);

        // test same operations in different orders
        let mut gc = GridController::default();
        gc.add_sheet(None, None, None, false);
        third(&mut gc);
        second(&mut gc);
        first(&mut gc);
        check_operations(&gc);

        // test same operations in different orders
        let mut gc = GridController::default();
        gc.add_sheet(None, None, None, false);
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
            x: 1,
            y: 1,
            sheet_id,
        };
        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Formula,
            "1 + 1".to_string(),
            None,
            None,
            false,
        );
        gc.rerun_all_code_cells(None, false);
        gc.rerun_code_cell(
            A1Selection::test_a1_context("A1", gc.a1_context()),
            None,
            false,
        );
        gc.rerun_sheet_code_cells(sheet_id, None, false);
    }
}
