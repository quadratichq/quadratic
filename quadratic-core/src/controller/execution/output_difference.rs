use crate::{grid::CodeCellRunResult, SheetPos, SheetRect};

pub(crate) fn output_difference(
    sheet_pos: SheetPos,
    old_output_run: Option<CodeCellRunResult>,
    output_run: Option<CodeCellRunResult>,
) -> Vec<SheetRect> {
    let mut rects = Vec::new();
    if old_output_run != output_run {
        if let Some(old_output_run) = old_output_run {
            if let Some(cells_accessed) = old_output_run.cells_accessed() {
                rects.push(SheetRect::from_cells(cells_accessed.iter().cloned()));
            }
        }
        if let Some(output_run) = output_run {
            if let Some(cells_accessed) = output_run.cells_accessed() {
                rects.push(SheetRect::from_cells(cells_accessed.iter().cloned()));
            }
        }
    }
    rects
