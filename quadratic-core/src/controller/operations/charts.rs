use crate::{controller::GridController, grid::SheetId};

use super::operation::Operation;

impl GridController {
    pub fn check_chart_insert_col_operations(
        &self,
        sheet_id: SheetId,
        column: u32,
    ) -> Vec<Operation> {
        let mut ops = vec![];
        if let Some(sheet) = self.try_sheet(sheet_id) {
            let charts = sheet.charts_in_column(column);

            for (sheet_pos, (width, height)) in charts {
                ops.push(Operation::SetChartCellSize {
                    sheet_pos,
                    w: width + 1,
                    h: height,
                });
            }
        }

        ops
    }

    pub fn check_chart_delete_col_operations(
        &self,
        sheet_id: SheetId,
        column: u32,
    ) -> Vec<Operation> {
        let mut ops = vec![];
        if let Some(sheet) = self.try_sheet(sheet_id) {
            let charts = sheet.charts_in_column(column);

            for (sheet_pos, (width, height)) in charts {
                if width - 1 > 0 && sheet_pos.x != column as i64 {
                    ops.push(Operation::SetChartCellSize {
                        sheet_pos,
                        w: width - 1,
                        h: height,
                    });
                }
            }
        }
        ops
    }

    pub fn check_chart_insert_row_operations(&self, sheet_id: SheetId, row: u32) -> Vec<Operation> {
        let mut ops = vec![];
        if let Some(sheet) = self.try_sheet(sheet_id) {
            let charts = sheet.charts_in_row(row);

            for (sheet_pos, (width, height)) in charts {
                ops.push(Operation::SetChartCellSize {
                    sheet_pos,
                    w: width,
                    h: height + 1,
                });
            }
        }
        ops
    }

    pub fn check_chart_delete_row_operations(&self, sheet_id: SheetId, row: u32) -> Vec<Operation> {
        let mut ops = vec![];
        if let Some(sheet) = self.try_sheet(sheet_id) {
            let charts = sheet.charts_in_row(row);

            for (sheet_pos, (width, height)) in charts {
                if height - 1 > 0 && sheet_pos.y != row as i64 {
                    ops.push(Operation::SetChartCellSize {
                        sheet_pos,
                        w: width,
                        h: height - 1,
                    });
                }
            }
        }
        ops
    }
}
