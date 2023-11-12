use indexmap::IndexSet;
use itertools::Itertools;

use crate::{
    controller::{
        transaction_summary::TransactionSummary, update_code_cell_value::update_code_cell_value,
        GridController,
    },
    grid::{CellRef, RegionRef},
};

use super::operation::Operation;

impl GridController {
    pub fn check_spills(
        &mut self,
        region: RegionRef,
        cells_to_compute: &mut IndexSet<CellRef>,
        summary: &mut TransactionSummary,
        reverse_operations: &mut Vec<Operation>,
    ) {
        // check if the cell causes a spill
        region.iter().for_each(|cell_ref| {
            let sheet = self.grid.sheet_from_id(region.sheet);
            if let Some(pos) = sheet.cell_ref_to_pos(cell_ref) {
                if let Some(column) = sheet.get_column(pos.x) {
                    if let Some(code_cell_ref) = column.spills.get(pos.y) {
                        if let Some(code_cell) = sheet.get_code_cell_from_ref(code_cell_ref) {
                            let array_size = code_cell.output_size();
                            let w = array_size.w.into();
                            let h = array_size.h.into();
                            if w > 1 || h > 1 {
                                let should_spill = sheet.spilled(code_cell_ref, w, h);
                                if (should_spill && !code_cell.spill_error())
                                    || (!should_spill && code_cell.spill_error())
                                {
                                    update_code_cell_value(
                                        self,
                                        code_cell_ref,
                                        Some(code_cell.clone()),
                                        cells_to_compute,
                                        reverse_operations,
                                        summary,
                                    );
                                }
                            }
                        }
                    }
                }
            }
        });

        // check if the cell releases a spill
        // sort by last_modified so that we can check the oldest code_cell run first
        let sheet = self.grid.sheet_from_id(region.sheet);
        let unspill = sheet
            .code_cells
            .iter()
            .filter(|(_, code_cell)| code_cell.spill_error())
            .sorted_by(|a, b| a.1.last_modified.cmp(&b.1.last_modified))
            .filter_map(|(cell_ref, code_cell)| {
                if let Some(mut rect) = code_cell.output_rect() {
                    if let Some(pos) = sheet.cell_ref_to_pos(*cell_ref) {
                        rect.translate(pos.x, pos.y);
                        let region = sheet.existing_region(rect);
                        if region.contains(*cell_ref) {
                            Some((cell_ref.clone(), code_cell.clone()))
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .find(|(cell_ref, code_cell)| {
                let array_size = code_cell.output_size();
                let w = array_size.w.into();
                let h = array_size.h.into();
                if w > 1 || h > 1 {
                    !sheet.spilled(*cell_ref, w, h)
                } else {
                    false
                }
            });

        if let Some((cell_ref, code_cell_value)) = unspill {
            update_code_cell_value(
                self,
                cell_ref,
                Some(code_cell_value),
                cells_to_compute,
                reverse_operations,
                summary,
            );
        }
    }
}

#[cfg(test)]
mod test {
    use crate::{
        controller::GridController,
        grid::{js_types::JsRenderCell, CellAlign, CodeCellLanguage},
        Pos, Rect,
    };

    #[test]
    fn test_check_spills() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];

        // values to copy
        gc.set_cell_value(sheet_id, Pos { x: 1, y: 0 }, "1".into(), None);
        gc.set_cell_value(sheet_id, Pos { x: 1, y: 1 }, "2".into(), None);
        gc.set_cell_value(sheet_id, Pos { x: 1, y: 2 }, "3".into(), None);

        // value to cause the spill
        gc.set_cell_value(sheet_id, Pos { x: 0, y: 1 }, "hello".into(), None);
        gc.set_cell_code(
            sheet_id,
            Pos { x: 0, y: 0 },
            CodeCellLanguage::Formula,
            "B0:B3".into(),
            None,
        );
        let sheet = gc.grid.sheet_from_id(sheet_id);
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 0, y: 0 }));

        // should be a spill caused by 0,1
        assert_eq!(
            render_cells,
            vec![JsRenderCell {
                x: 0,
                y: 0,
                language: Some(CodeCellLanguage::Formula),
                value: " SPILL".into(),
                align: None,
                wrap: None,
                bold: None,
                italic: Some(true),
                text_color: Some("red".into())
            }]
        );

        // remove 'hello' that caused spill
        gc.set_cell_value(sheet_id, Pos { x: 0, y: 1 }, "".into(), None);

        let sheet = gc.grid.sheet_from_id(sheet_id);
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 0, y: 0 }));

        // should be B0: "1" since spill was removed
        assert_eq!(
            render_cells,
            vec![JsRenderCell {
                x: 0,
                y: 0,
                language: Some(CodeCellLanguage::Formula),
                value: "1".into(),
                align: Some(CellAlign::Right),
                wrap: None,
                bold: None,
                italic: None,
                text_color: None
            }]
        );
    }
}
