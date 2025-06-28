use std::collections::HashSet;

use super::operation::Operation;
use crate::{
    CellValue, MultiPos, SheetPos,
    a1::A1Selection,
    cell_values::CellValues,
    controller::GridController,
    formulas::convert_rc_to_a1,
    grid::{CodeCellLanguage, CodeCellValue, SheetId},
};

impl GridController {
    /// Adds operations to compute a CellValue::Code.
    pub fn set_code_cell_operations(
        &self,
        multi_pos: MultiPos,
        language: CodeCellLanguage,
        code: String,
        code_cell_name: Option<String>,
    ) -> Vec<Operation> {
        let Some(sheet) = self.try_sheet(multi_pos.sheet_id()) else {
            return vec![];
        };

        // converted absolute sheet position -- if not available, then nothing more to do here
        let Some(sheet_pos) = multi_pos.to_sheet_pos(sheet) else {
            return vec![];
        };

        let parse_ctx = self.a1_context();
        let code = match language {
            CodeCellLanguage::Formula => convert_rc_to_a1(&code, parse_ctx, sheet_pos),
            _ => code,
        };

        let mut ops = vec![];

        let values = CellValues::from(CellValue::Code(CodeCellValue { language, code }));
        if let MultiPos::TablePos(table_pos) = multi_pos {
            ops.push(Operation::SetDataTableAt {
                sheet_pos: SheetPos {
                    x: table_pos.table_sheet_pos.x + table_pos.pos.x,
                    y: table_pos.table_sheet_pos.y + table_pos.pos.y,
                    sheet_id: table_pos.table_sheet_pos.sheet_id,
                },
                values,
            });
        } else {
            ops.push(Operation::SetCellValues { sheet_pos, values });
        }
        ops.push(Operation::ComputeCodeMultiPos { multi_pos });

        // change the code cell name if it is provided and the code cell doesn't
        // already have a name. Note: this is only for non-table code cells.
        if !multi_pos.is_table_pos() {
            if let Some(code_cell_name) = code_cell_name {
                if self.data_table_at(multi_pos).is_none() {
                    ops.push(Operation::DataTableMeta {
                        sheet_pos,
                        name: Some(code_cell_name),
                        alternating_colors: None,
                        columns: None,
                        show_ui: None,
                        show_name: None,
                        show_columns: None,
                        readonly: None,
                    });
                }
            }
        }
        ops
    }

    /// Reruns a code cell
    pub fn rerun_code_cell_operations(&self, selection: A1Selection) -> Vec<Operation> {
        let mut ops = vec![];

        let sheet_id = selection.sheet_id;
        if let Some(sheet) = self.try_sheet(sheet_id) {
            let rects =
                sheet.selection_to_rects(&selection, false, false, true, self.a1_context(), None);
            rects.iter().for_each(|rect| {
                sheet
                    .data_tables
                    .get_code_runs_in_rect(*rect, false, sheet_id, true)
                    .for_each(|(_, multi_pos, _)| {
                        ops.push(Operation::ComputeCodeMultiPos { multi_pos });
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
                code_cell_positions.push(MultiPos::new_sheet_pos(*sheet_id, pos.x, pos.y));
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
        for (table_pos, dt) in sheet.data_tables.expensive_iter() {
            if dt.code_run().is_some() {
                code_cell_positions.push(MultiPos::new_sheet_pos(
                    sheet_id,
                    table_pos.x,
                    table_pos.y,
                ));
            } else {
                if let Some(tables) = &dt.tables {
                    for (pos, _) in tables.expensive_iter_code_runs() {
                        code_cell_positions.push(MultiPos::new_table_pos(
                            sheet_id,
                            table_pos.x,
                            table_pos.y,
                            pos.x,
                            pos.y,
                        ));
                    }
                }
            }
        }

        self.get_code_run_ops_from_positions(code_cell_positions)
    }

    fn get_code_run_ops_from_positions(
        &self,
        code_cell_positions: Vec<MultiPos>,
    ) -> Vec<Operation> {
        let code_cell_positions = self.order_code_cells(code_cell_positions);
        code_cell_positions
            .into_iter()
            .map(|multi_pos| Operation::ComputeCodeMultiPos { multi_pos })
            .collect()
    }

    /// Orders code cells to ensure earlier computes do not depend on later computes.
    fn order_code_cells(&self, code_cell_positions: Vec<MultiPos>) -> Vec<MultiPos> {
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
        multi_pos: &MultiPos,
        seen: &mut HashSet<MultiPos>,
    ) -> Vec<MultiPos> {
        if !seen.insert(*multi_pos) {
            return vec![];
        }

        let Some(code_run) = self.code_run_at(*multi_pos) else {
            return vec![];
        };

        let mut parent_nodes = Vec::new();
        for (sheet_id, rect) in code_run
            .cells_accessed
            .iter_rects_unbounded(&self.a1_context)
        {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                for (_, multi_pos, _) in sheet
                    .data_tables
                    .get_code_runs_in_sorted(rect, false, sheet_id, true)
                {
                    if !seen.contains(&multi_pos) {
                        parent_nodes.push(multi_pos);
                    }
                }
            }
        }

        let mut upstream = vec![];
        for node in parent_nodes.into_iter() {
            upstream.extend(self.get_upstream_dependents(&node, seen));
        }
        upstream.push(*multi_pos);
        upstream
    }
}

#[cfg(test)]
mod test {
    use bigdecimal::BigDecimal;

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
            pos.to_sheet_pos(sheet_id).into(),
            CodeCellLanguage::Python,
            "print('hello world')".to_string(),
            None,
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
            Operation::ComputeCodeMultiPos {
                multi_pos: pos.to_multi_pos(sheet_id),
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
                MultiPos::new_sheet_pos(sheet_id, 1, 1),
                CodeCellLanguage::Formula,
                "1 + 1".to_string(),
                None,
                None,
            );
        };

        // (2, 2) = A1
        let second = |gc: &mut GridController| {
            let sheet_id = gc.sheet_ids()[0];
            gc.set_code_cell(
                MultiPos::new_sheet_pos(sheet_id, 2, 2),
                CodeCellLanguage::Formula,
                "A1".to_string(),
                None,
                None,
            );
        };

        // (1, 1, Sheet 2) = Sheet1:A1
        let third = |gc: &mut GridController| {
            let sheet_id_2 = gc.sheet_ids()[1];
            gc.set_code_cell(
                MultiPos::new_sheet_pos(sheet_id_2, 1, 1),
                CodeCellLanguage::Formula,
                format!("'{}1'!A1", SHEET_NAME.to_owned()),
                None,
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
            x: 1,
            y: 1,
            sheet_id,
        };
        gc.set_code_cell(
            sheet_pos.into(),
            CodeCellLanguage::Formula,
            "1 + 1".to_string(),
            None,
            None,
        );
        gc.rerun_all_code_cells(None);
        gc.rerun_code_cell(A1Selection::test_a1_context("A1", gc.a1_context()), None);
        gc.rerun_sheet_code_cells(sheet_id, None);
    }
}
