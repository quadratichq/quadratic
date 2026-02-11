use std::collections::HashSet;

use super::operation::Operation;
use crate::{
    CellValue, Pos, RefAdjust, SheetPos, Value,
    a1::A1Selection,
    controller::GridController,
    formulas::convert_rc_to_a1,
    grid::{
        CodeCellLanguage, CodeRun, DataTable, DataTableKind, SheetId, js_types::JsSnackbarSeverity,
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
        let mut ops = vec![];

        let Some(sheet) = self.try_sheet(sheet_pos.sheet_id) else {
            // sheet may have been deleted in a multiplayer operation
            return ops;
        };

        let pos = sheet_pos.into();

        // Check if it's an anchor cell (source cell)
        if sheet.is_source_cell(pos) {
            // Block if it's an import cell (imports don't have anchors)
            if sheet.is_data_table_cell(pos) {
                if cfg!(target_family = "wasm") || cfg!(test) {
                    crate::wasm_bindings::js::jsClientMessage(
                        "Cannot add code cell to table".to_string(),
                        JsSnackbarSeverity::Error.to_string(),
                    );
                }
                return ops;
            }
            // Otherwise it's a code cell anchor - allowed
        } else if sheet.data_table_pos_that_contains(pos).is_some() {
            // It's in the output area - block it (can't write to output area without overwriting anchor)
            if cfg!(target_family = "wasm") || cfg!(test) {
                crate::wasm_bindings::js::jsClientMessage(
                    "Cannot add code cell to table".to_string(),
                    JsSnackbarSeverity::Error.to_string(),
                );
            }
            return ops;
        }

        let code = match language {
            CodeCellLanguage::Formula => convert_rc_to_a1(&code, self.a1_context(), sheet_pos),
            _ => code,
        };

        if let Some((existing_data_table_index, existing_data_table)) =
            sheet.data_table_full_at(&sheet_pos.into())
            && let DataTableKind::CodeRun(existing_code_run) = &existing_data_table.kind
            && existing_code_run.language == language
        {
            ops.push(Operation::SetDataTable {
                sheet_pos,
                data_table: Some(DataTable {
                    kind: DataTableKind::CodeRun(CodeRun {
                        language,
                        code,
                        formula_ast: None,
                        ..existing_code_run.clone()
                    }),
                    ..existing_data_table.clone()
                }),
                index: existing_data_table_index,
                ignore_old_data_table: false,
            });
        } else if let Some(CellValue::Code(existing_code_cell)) = sheet.cell_value_ref(pos)
            && existing_code_cell.code_run.language == language
        {
            // Existing CellValue::Code - preserve the output value until new calculation completes
            let name = CellValue::Text(format!("{}1", language.as_string()));
            ops.push(Operation::SetDataTable {
                sheet_pos,
                data_table: Some(DataTable {
                    kind: DataTableKind::CodeRun(CodeRun {
                        language,
                        code,
                        formula_ast: None,
                        ..existing_code_cell.code_run.clone()
                    }),
                    name,
                    header_is_first_row: false,
                    show_name: None,
                    show_columns: None,
                    column_headers: None,
                    sort: None,
                    sort_dirty: false,
                    display_buffer: None,
                    value: Value::Single((*existing_code_cell.output).clone()), // Preserve old output
                    spill_value: false,
                    spill_data_table: false,
                    spill_merged_cell: false,
                    last_modified: existing_code_cell.last_modified,
                    alternating_colors: true,
                    formats: None,
                    borders: None,
                    chart_pixel_output: None,
                    chart_output: None,
                }),
                index: usize::MAX,
                ignore_old_data_table: false,
            });
        } else {
            let name = CellValue::Text(
                code_cell_name.unwrap_or_else(|| format!("{}1", language.as_string())),
            );

            ops.push(Operation::SetDataTable {
                sheet_pos,
                data_table: Some(DataTable {
                    kind: DataTableKind::CodeRun(CodeRun {
                        language,
                        code,
                        ..Default::default()
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
                    spill_merged_cell: false,
                    last_modified: now(),
                    alternating_colors: true,
                    formats: None,
                    borders: None,
                    chart_pixel_output: None,
                    chart_output: None,
                }),
                index: usize::MAX,
                ignore_old_data_table: false,
            });
        }

        ops.push(Operation::ComputeCode { sheet_pos });
        ops
    }

    pub fn set_formula_operations(
        &self,
        selection: A1Selection,
        code_string: String,
    ) -> Vec<Operation> {
        let mut ops = vec![];

        let Some(sheet) = self.try_sheet(selection.sheet_id) else {
            // sheet may have been deleted in a multiplayer operation
            return ops;
        };

        let rects = selection.rects(&self.a1_context);
        if rects.is_empty() {
            return ops;
        }

        // Check if any rect in the selection overlaps with data tables (set
        // formulas are more complicated than set code cells because it allows
        // writing formulas in a selection range)
        let intersects_data_table = rects
            .iter()
            .any(|rect| sheet.contains_data_table_within_rect(*rect, None));

        if intersects_data_table {
            // Check each cell in the selection to determine if we should allow or block:
            // - Block if it's an import cell (imports don't have anchors)
            // - Block if it's in the output area of a table whose anchor is NOT in the selection
            // - Allow if it's in the output area of a non-import table whose anchor IS in the selection
            for rect in &rects {
                for x in rect.min.x..=rect.max.x {
                    for y in rect.min.y..=rect.max.y {
                        let pos = crate::Pos { x, y };

                        // Check if it's an anchor cell (source cell)
                        if sheet.is_source_cell(pos) {
                            // Block if it's an import cell
                            if sheet.is_data_table_cell(pos) {
                                if cfg!(target_family = "wasm") || cfg!(test) {
                                    crate::wasm_bindings::js::jsClientMessage(
                                        "Cannot add code cell to table".to_string(),
                                        JsSnackbarSeverity::Error.to_string(),
                                    );
                                }
                                return ops;
                            }
                            // Otherwise it's a code cell anchor - allowed
                        } else if let Some(anchor_pos) = sheet.data_table_pos_that_contains(pos) {
                            // It's in the output area - check if the anchor is in the selection
                            let anchor_in_selection = rects.iter().any(|r| {
                                r.min.x <= anchor_pos.x
                                    && anchor_pos.x <= r.max.x
                                    && r.min.y <= anchor_pos.y
                                    && anchor_pos.y <= r.max.y
                            });

                            if !anchor_in_selection {
                                // Block: output area cell whose anchor is not in the selection
                                if cfg!(target_family = "wasm") || cfg!(test) {
                                    crate::wasm_bindings::js::jsClientMessage(
                                        "Cannot add code cell to table".to_string(),
                                        JsSnackbarSeverity::Error.to_string(),
                                    );
                                }
                                return ops;
                            }
                            // Also check if the table is an import (imports don't have anchors)
                            if let Some(data_table) = sheet.data_table_at(&anchor_pos)
                                && matches!(data_table.kind, DataTableKind::Import(_))
                            {
                                if cfg!(target_family = "wasm") || cfg!(test) {
                                    crate::wasm_bindings::js::jsClientMessage(
                                        "Cannot add code cell to table".to_string(),
                                        JsSnackbarSeverity::Error.to_string(),
                                    );
                                }
                                return ops;
                            }
                        }
                    }
                }
            }
        }

        let first_pos = rects[0].min.to_sheet_pos(selection.sheet_id);
        rects.iter().for_each(|rect| {
            for x in rect.min.x..=rect.max.x {
                for y in rect.min.y..=rect.max.y {
                    let sheet_pos = SheetPos {
                        x,
                        y,
                        sheet_id: selection.sheet_id,
                    };

                    // Adjust formula references if this isn't the first position
                    let adjusted_code = if first_pos != sheet_pos {
                        let ref_adjust = RefAdjust {
                            sheet_id: Some(first_pos.sheet_id),
                            relative_only: true,
                            dx: x - first_pos.x,
                            dy: y - first_pos.y,
                            x_start: 0,
                            y_start: 0,
                        };
                        let mut code_run = CodeRun {
                            language: CodeCellLanguage::Formula,
                            code: code_string.clone(),
                            ..Default::default()
                        };
                        code_run.adjust_references(
                            selection.sheet_id,
                            self.a1_context(),
                            sheet_pos,
                            ref_adjust,
                        );
                        code_run.code
                    } else {
                        code_string.clone()
                    };

                    // Use SetComputeCode to avoid double finalization
                    ops.push(Operation::SetComputeCode {
                        sheet_pos,
                        language: CodeCellLanguage::Formula,
                        code: adjusted_code,
                        template: None,
                    });
                }
            }
        });
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
            // Check data_tables
            for (pos, _) in sheet.data_tables.expensive_iter_code_runs() {
                code_cell_positions.push(pos.to_sheet_pos(*sheet_id));
            }
            // Check CellValue::Code in columns
            for pos in sheet.iter_code_cells_positions() {
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
        // Check data_tables
        for (pos, _) in sheet.data_tables.expensive_iter_code_runs() {
            code_cell_positions.push(pos.to_sheet_pos(sheet_id));
        }
        // Check CellValue::Code in columns
        for pos in sheet.iter_code_cells_positions() {
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
    pub(crate) fn order_code_cells(&self, code_cell_positions: Vec<SheetPos>) -> Vec<SheetPos> {
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

    /// Gets all upstream dependents of a code cell in topological order
    /// (dependencies come before dependents).
    ///
    /// Uses an iterative approach with an explicit stack to avoid stack
    /// overflow in dev builds when there are many interdependent formulas.
    pub(super) fn get_upstream_dependents(
        &self,
        sheet_pos: &SheetPos,
        seen: &mut HashSet<SheetPos>,
    ) -> Vec<SheetPos> {
        // State for iterative DFS: (position, have_we_visited_children)
        let mut stack: Vec<(SheetPos, bool)> = vec![(*sheet_pos, false)];
        let mut result = Vec::new();

        while let Some((current_pos, children_visited)) = stack.pop() {
            if children_visited {
                // Post-order: add to result after all children have been processed
                result.push(current_pos);
                continue;
            }

            // Check if already seen
            if !seen.insert(current_pos) {
                continue;
            }

            // Push current node back with children_visited=true for post-order processing
            stack.push((current_pos, true));

            let Some(code_run) = self.code_run_at(&current_pos) else {
                // No code_run exists yet - it will be added in post-order
                continue;
            };

            // Collect parent nodes (cells this formula depends on)
            for (sheet_id, rect) in code_run
                .cells_accessed
                .iter_rects_unbounded(&self.a1_context)
            {
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    // Check data_tables for code runs
                    for (_, pos, _) in sheet.data_tables.get_code_runs_in_sorted(rect, false) {
                        let parent_pos = pos.to_sheet_pos(sheet_id);
                        if !seen.contains(&parent_pos) {
                            // Push parent nodes to process before current node
                            stack.push((parent_pos, false));
                        }
                    }
                    // Also check for CellValue::Code cells in the rect
                    for y in rect.y_range() {
                        for x in rect.x_range() {
                            let pos = Pos { x, y };
                            if matches!(sheet.cell_value_ref(pos), Some(CellValue::Code(_))) {
                                let parent_pos = pos.to_sheet_pos(sheet_id);
                                if !seen.contains(&parent_pos) {
                                    stack.push((parent_pos, false));
                                }
                            }
                        }
                    }
                }
            }
        }

        result
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{Pos, constants::SHEET_NAME};

    #[test]
    fn test_set_code_cell_operations() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = pos![sheet_id!A1];
        gc.set_cell_value(sheet_pos, "delete me".to_string(), None, false);

        let operations = gc.set_code_cell_operations(
            sheet_pos,
            CodeCellLanguage::Python,
            "print('hello world')".to_string(),
            None,
        );
        assert_eq!(operations.len(), 2);
        let Operation::SetDataTable { data_table, .. } = &operations[0] else {
            panic!("Expected SetDataTable");
        };
        assert_eq!(
            data_table.as_ref().unwrap().kind,
            DataTableKind::CodeRun(CodeRun {
                language: CodeCellLanguage::Python,
                code: "print('hello world')".to_string(),
                ..Default::default()
            })
        );

        assert_eq!(operations[1], Operation::ComputeCode { sheet_pos });
    }

    #[test]
    fn test_set_code_cell_overwrites_formula_anchor() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a formula code cell at A1
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Formula,
            "=1+1".to_string(),
            None,
            None,
            false,
        );

        // Should allow overwriting the anchor cell
        let ops = gc.set_code_cell_operations(
            pos![sheet_id!A1],
            CodeCellLanguage::Python,
            "print('hello')".to_string(),
            None,
        );
        assert!(
            !ops.is_empty(),
            "Should allow overwriting formula anchor cell"
        );
    }

    #[test]
    fn test_set_code_cell_overwrites_python_anchor() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a Python code cell at A1
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Python,
            "1 + 1".to_string(),
            None,
            None,
            false,
        );

        // Should allow overwriting the anchor cell
        let ops = gc.set_code_cell_operations(
            pos![sheet_id!A1],
            CodeCellLanguage::Javascript,
            "1 + 1".to_string(),
            None,
        );
        assert!(
            !ops.is_empty(),
            "Should allow overwriting Python anchor cell"
        );
    }

    #[test]
    fn test_set_code_cell_overwrites_javascript_anchor() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a Javascript code cell at A1
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Javascript,
            "1 + 1".to_string(),
            None,
            None,
            false,
        );

        // Should allow overwriting the anchor cell
        let ops = gc.set_code_cell_operations(
            pos![sheet_id!A1],
            CodeCellLanguage::Formula,
            "=1+1".to_string(),
            None,
        );
        assert!(
            !ops.is_empty(),
            "Should allow overwriting Javascript anchor cell"
        );
    }

    #[test]
    fn test_set_code_cell_blocks_output_area() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a code table that outputs to multiple cells (e.g., A1 outputs to A1:A3)
        use crate::test_util::test_create_code_table;
        test_create_code_table(&mut gc, sheet_id, pos![A1], 1, 3);

        // Should block setting code cell in output area (A2, which is not the anchor)
        let ops = gc.set_code_cell_operations(
            pos![sheet_id!A2],
            CodeCellLanguage::Python,
            "print('hello')".to_string(),
            None,
        );
        assert!(
            ops.is_empty(),
            "Should block setting code cell in output area"
        );
    }

    #[test]
    fn test_set_code_cell_blocks_import_cell() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create an import table at A1
        gc.test_set_data_table(pos![sheet_id!A1], 2, 2, false, None, None);

        // Should block setting code cell on import cell
        let ops = gc.set_code_cell_operations(
            pos![sheet_id!A1],
            CodeCellLanguage::Python,
            "print('hello')".to_string(),
            None,
        );
        assert!(
            ops.is_empty(),
            "Should block setting code cell on import cell"
        );
    }

    #[test]
    fn test_set_code_cell_blocks_import_output_area() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create an import table at A1 that outputs to A1:B2
        gc.test_set_data_table(pos![sheet_id!A1], 2, 2, false, None, None);

        // Should block setting code cell in import output area
        let ops = gc.set_code_cell_operations(
            pos![sheet_id!A2],
            CodeCellLanguage::Python,
            "print('hello')".to_string(),
            None,
        );
        assert!(
            ops.is_empty(),
            "Should block setting code cell in import output area"
        );
    }

    #[test]
    fn test_rerun_all_code_cells_operations() {
        let mut gc = GridController::test();
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
        let mut gc = GridController::test();
        gc.add_sheet(None, None, None, false);

        second(&mut gc);
        third(&mut gc);
        first(&mut gc);
        check_operations(&gc);

        // test same operations in different orders
        let mut gc = GridController::test();
        gc.add_sheet(None, None, None, false);
        first(&mut gc);
        third(&mut gc);
        second(&mut gc);
        check_operations(&gc);

        // test same operations in different orders
        let mut gc = GridController::test();
        gc.add_sheet(None, None, None, false);
        third(&mut gc);
        second(&mut gc);
        first(&mut gc);
        check_operations(&gc);

        // test same operations in different orders
        let mut gc = GridController::test();
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
        let mut gc = GridController::test();
        first(&mut gc);
        second(&mut gc);
        check_sheet_operations(&gc);

        // test same operations in different orders
        let mut gc = GridController::test();
        second(&mut gc);
        first(&mut gc);
        check_sheet_operations(&gc);
    }

    #[test]
    fn rerun_all_code_cells_one() {
        let mut gc = GridController::test();
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

    #[test]
    fn test_set_formula_overwrites_formula_anchor() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a formula code cell at A1
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Formula,
            "=1+1".to_string(),
            None,
            None,
            false,
        );
        // Run the code cell to create the data table
        gc.rerun_all_code_cells(None, false);

        // Verify the data table exists
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert!(
            sheet.is_source_cell(pos![A1]),
            "Data table should exist at A1"
        );
        assert!(
            !sheet.is_data_table_cell(pos![A1]),
            "A1 should not be an import cell"
        );
        assert!(
            sheet.contains_data_table_within_rect(
                crate::Rect {
                    min: pos![A1],
                    max: pos![A1],
                },
                None
            ),
            "Selection should intersect with data table"
        );

        // Should allow overwriting the anchor cell
        let ops = gc.set_formula_operations(A1Selection::test_a1("A1"), "=2+2".to_string());
        assert!(
            !ops.is_empty(),
            "Should allow overwriting formula anchor cell"
        );
    }

    #[test]
    fn test_set_formula_overwrites_python_anchor() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a Python code cell at A1
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Python,
            "1 + 1".to_string(),
            None,
            None,
            false,
        );
        // Run the code cell to create the data table
        gc.rerun_all_code_cells(None, false);

        // Should allow overwriting the anchor cell with a formula
        let ops = gc.set_formula_operations(A1Selection::test_a1("A1"), "=2+2".to_string());
        assert!(
            !ops.is_empty(),
            "Should allow overwriting Python anchor cell"
        );
    }

    #[test]
    fn test_set_formula_overwrites_javascript_anchor() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a Javascript code cell at A1
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Javascript,
            "1 + 1".to_string(),
            None,
            None,
            false,
        );
        // Run the code cell to create the data table
        gc.rerun_all_code_cells(None, false);

        // Should allow overwriting the anchor cell with a formula
        let ops = gc.set_formula_operations(A1Selection::test_a1("A1"), "=2+2".to_string());
        assert!(
            !ops.is_empty(),
            "Should allow overwriting Javascript anchor cell"
        );
    }

    #[test]
    fn test_set_formula_blocks_output_area() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a code table that outputs to multiple cells (e.g., A1 outputs to A1:A3)
        use crate::test_util::test_create_code_table;
        test_create_code_table(&mut gc, sheet_id, pos![A1], 1, 3);

        // Should block setting formula in output area (A2, which is not the anchor)
        // when the anchor is NOT being overwritten
        let ops = gc.set_formula_operations(A1Selection::test_a1("A2"), "=1+1".to_string());
        assert!(
            ops.is_empty(),
            "Should block setting formula in output area when anchor is not overwritten"
        );

        // Should allow if selection includes both anchor and output area
        // (overwriting the anchor allows writing to its output area)
        let ops = gc.set_formula_operations(A1Selection::test_a1("A1:A2"), "=1+1".to_string());
        assert!(
            !ops.is_empty(),
            "Should allow if selection includes anchor and its output area"
        );
    }

    #[test]
    fn test_set_formula_blocks_import_cell() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create an import table at A1
        gc.test_set_data_table(pos![sheet_id!A1], 2, 2, false, None, None);

        // Should block setting formula on import cell
        let ops = gc.set_formula_operations(A1Selection::test_a1("A1"), "=1+1".to_string());
        assert!(
            ops.is_empty(),
            "Should block setting formula on import cell"
        );
    }

    #[test]
    fn test_set_formula_blocks_import_output_area() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create an import table at A1 that outputs to A1:B2
        gc.test_set_data_table(pos![sheet_id!A1], 2, 2, false, None, None);

        // Should block setting formula in import output area
        let ops = gc.set_formula_operations(A1Selection::test_a1("A2"), "=1+1".to_string());
        assert!(
            ops.is_empty(),
            "Should block setting formula in import output area"
        );

        // Should also block if selection includes import anchor
        let ops = gc.set_formula_operations(A1Selection::test_a1("A1:A2"), "=1+1".to_string());
        assert!(
            ops.is_empty(),
            "Should block if selection includes import cell"
        );
    }

    #[test]
    fn test_get_upstream_dependents_without_code_run() {
        // Tests that get_upstream_dependents returns the position even when
        // no code_run exists yet (e.g., when SetDataTable hasn't been executed).
        // This prevents positions from being lost when order_code_cells rebuilds
        // the operation queue.
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 1,
            y: 1,
            sheet_id,
        };

        // No code_run exists at this position
        assert!(
            gc.code_run_at(&sheet_pos).is_none(),
            "Precondition: no code_run should exist at position"
        );

        let mut seen = HashSet::new();
        let result = gc.get_upstream_dependents(&sheet_pos, &mut seen);

        assert_eq!(
            result,
            vec![sheet_pos],
            "Should return the position even without a code_run"
        );
        assert!(
            seen.contains(&sheet_pos),
            "Position should be marked as seen"
        );
    }

    #[test]
    fn test_order_code_cells_preserves_positions_without_code_runs() {
        // Tests that order_code_cells preserves positions even when code_runs
        // don't exist yet. This is important for scenarios like when SetDataTable
        // hasn't been executed yet but we still need to track the position.
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let positions = vec![
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            SheetPos {
                x: 2,
                y: 2,
                sheet_id,
            },
            SheetPos {
                x: 3,
                y: 3,
                sheet_id,
            },
        ];

        // None of these positions have code_runs
        for pos in &positions {
            assert!(
                gc.code_run_at(pos).is_none(),
                "Precondition: no code_run should exist at position {:?}",
                pos
            );
        }

        let ordered = gc.order_code_cells(positions.clone());

        // All positions should be preserved in the output
        assert_eq!(
            ordered.len(),
            positions.len(),
            "All positions should be preserved even without code_runs"
        );
        for pos in &positions {
            assert!(
                ordered.contains(pos),
                "Position {:?} should be in the ordered output",
                pos
            );
        }
    }

    #[test]
    fn test_get_upstream_dependents_already_seen() {
        // Tests that get_upstream_dependents returns empty when position
        // has already been seen (cycle detection).
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 1,
            y: 1,
            sheet_id,
        };

        let mut seen = HashSet::new();
        seen.insert(sheet_pos); // Pre-mark as seen

        let result = gc.get_upstream_dependents(&sheet_pos, &mut seen);

        assert!(
            result.is_empty(),
            "Should return empty when position was already seen"
        );
    }

    #[test]
    fn test_changing_formula_clears_cached_ast() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(pos![sheet_id!A1], "1".into(), None, false);

        // Set A2 = A1+1, should evaluate to 2
        gc.set_code_cell(
            pos![sheet_id!A2],
            CodeCellLanguage::Formula,
            "A1+1".to_string(),
            None,
            None,
            false,
        );
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Number(2.into())),
            "A2 should be 2 (A1+1 = 1+1)"
        );

        // Change A2 to =A1, should evaluate to 1
        gc.set_code_cell(
            pos![sheet_id!A2],
            CodeCellLanguage::Formula,
            "A1".to_string(),
            None,
            None,
            false,
        );
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Number(1.into())),
            "A2 should be 1 after changing formula to =A1"
        );

        // Change A2 to =A1*10, should evaluate to 10
        gc.set_code_cell(
            pos![sheet_id!A2],
            CodeCellLanguage::Formula,
            "A1*10".to_string(),
            None,
            None,
            false,
        );
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Number(10.into())),
            "A2 should be 10 after changing formula to =A1*10"
        );
    }
}
