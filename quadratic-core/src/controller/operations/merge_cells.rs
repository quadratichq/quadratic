use super::operation::Operation;
use crate::{
    a1::A1Selection, controller::GridController, grid::sheet::merge_cells::MergeCellsUpdate,
};

impl GridController {
    /// Creates merge cells operations from an A1Selection.
    pub fn merge_cells_a1_selection_operations(&self, selection: A1Selection) -> Vec<Operation> {
        let mut ops = vec![];

        let Some(sheet) = self.try_sheet(selection.sheet_id) else {
            return ops;
        };

        // For each range in the selection, create merge cells operations
        for range in selection.ranges.iter() {
            match range {
                crate::a1::CellRefRange::Sheet { range } => {
                    let mut rect = range.to_rect_unbounded();

                    // Skip single cell selections (should be handled by UI, but double-check)
                    if rect.min.x == rect.max.x && rect.min.y == rect.max.y {
                        continue;
                    }

                    // Expand the rect to include any partially overlapping merged cells.
                    // This ensures that when merging a region that overlaps with existing
                    // merged cells, the entire merged cells are included in the new merge.
                    loop {
                        let mut expanded = false;
                        let merged_cells = sheet.merge_cells.get_merge_cells(rect);
                        for merged_cell_rect in merged_cells.iter() {
                            if !rect.contains_rect(merged_cell_rect) {
                                rect.union_in_place(merged_cell_rect);
                                expanded = true;
                            }
                        }
                        if !expanded {
                            break;
                        }
                    }

                    // Check if the rect overlaps with any data table
                    // Merge cells do not work properly in tables, so we block this operation
                    if sheet.contains_data_table_within_rect(rect, None) {
                        #[cfg(any(target_family = "wasm", test))]
                        {
                            use crate::grid::js_types::JsSnackbarSeverity;

                            let message = "Cannot merge cells over tables, code, or formulas.";
                            let severity = JsSnackbarSeverity::Error;
                            crate::wasm_bindings::js::jsClientMessage(
                                message.into(),
                                severity.to_string(),
                            );
                        }
                        continue;
                    }

                    // Create merge cells update for this rect
                    let mut merge_cells_update = MergeCellsUpdate::default();
                    merge_cells_update.set_rect(
                        rect.min.x,
                        rect.min.y,
                        Some(rect.max.x),
                        Some(rect.max.y),
                        Some(crate::ClearOption::Some(rect.min)),
                    );

                    ops.push(Operation::SetMergeCells {
                        sheet_id: selection.sheet_id,
                        merge_cells_updates: merge_cells_update,
                    });
                }
                crate::a1::CellRefRange::Table { .. } => {
                    // Merge cells are not supported for table ranges
                    // Skip table ranges
                }
            }
        }

        ops
    }

    /// Creates unmerge cells operations from an A1Selection.
    /// Unmerges all merged cells that overlap with the selection.
    pub fn unmerge_cells_a1_selection_operations(&self, selection: A1Selection) -> Vec<Operation> {
        let mut ops = vec![];

        let Some(sheet) = self.try_sheet(selection.sheet_id) else {
            return ops;
        };

        // For each range in the selection, find and unmerge overlapping merged cells
        for range in selection.ranges.iter() {
            match range {
                crate::a1::CellRefRange::Sheet { range } => {
                    let rect = range.to_rect_unbounded();

                    // Get all merged cells that overlap with this rect
                    let merged_rects = sheet.merge_cells.get_merge_cells(rect);

                    // Also check cursor position for merged cell
                    if let Some(cursor_rect) =
                        sheet.merge_cells.get_merge_cell_rect(selection.cursor)
                    {
                        // Add cursor merged cell if not already in the list
                        if !merged_rects.contains(&cursor_rect) {
                            let mut merge_cells_update = MergeCellsUpdate::default();
                            merge_cells_update.set_rect(
                                cursor_rect.min.x,
                                cursor_rect.min.y,
                                Some(cursor_rect.max.x),
                                Some(cursor_rect.max.y),
                                Some(crate::ClearOption::Clear),
                            );

                            ops.push(Operation::SetMergeCells {
                                sheet_id: selection.sheet_id,
                                merge_cells_updates: merge_cells_update,
                            });
                        }
                    }

                    // Create unmerge operations for each merged cell found
                    for merged_rect in merged_rects {
                        let mut merge_cells_update = MergeCellsUpdate::default();
                        merge_cells_update.set_rect(
                            merged_rect.min.x,
                            merged_rect.min.y,
                            Some(merged_rect.max.x),
                            Some(merged_rect.max.y),
                            Some(crate::ClearOption::Clear),
                        );

                        ops.push(Operation::SetMergeCells {
                            sheet_id: selection.sheet_id,
                            merge_cells_updates: merge_cells_update,
                        });
                    }
                }
                crate::a1::CellRefRange::Table { .. } => {
                    // Merge cells are not supported for table ranges
                    // Skip table ranges
                }
            }
        }

        ops
    }
}
