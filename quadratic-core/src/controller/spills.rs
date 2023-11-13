use indexmap::IndexSet;

use crate::{
    controller::{
        transaction_summary::TransactionSummary, update_code_cell_value::update_code_cell_value,
        GridController,
    },
    grid::CellRef,
};

use super::operation::Operation;

impl GridController {
    pub fn check_spill(
        &mut self,
        cell_ref: CellRef,
        cells_to_compute: &mut IndexSet<CellRef>,
        summary: &mut TransactionSummary,
        reverse_operations: &mut Vec<Operation>,
    ) {
        // check if the change in a cell causes a spill or release of a spill error
        let sheet = self.grid.sheet_from_id(cell_ref.sheet);
        if let Some(pos) = sheet.cell_ref_to_pos(cell_ref) {
            if let Some(column) = sheet.get_column(pos.x) {
                if let Some(code_cell_ref) = column.spills.get(pos.y) {
                    if let Some(code_cell) = sheet.get_code_cell_from_ref(code_cell_ref) {
                        let array_size = code_cell.output_size();
                        let w = array_size.w.get();
                        let h = array_size.h.get();
                        // if the code_cell has an array output, then its spill status may change
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
        };
    }

    /// check if the deletion of a cell released a spill error
    pub fn check_release_spill(
        &mut self,
        cell_ref: CellRef,
        cells_to_compute: &mut IndexSet<CellRef>,
        summary: &mut TransactionSummary,
        reverse_operations: &mut Vec<Operation>,
    ) {
        let sheet = self.grid.sheet_from_id(cell_ref.sheet);
        if let Some((cell_ref, code_cell)) = sheet.release_spill_error(cell_ref) {
            update_code_cell_value(
                self,
                cell_ref,
                Some(code_cell),
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

    #[test]
    fn test_check_spills_over_code() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];

        // values to copy
        gc.set_cell_value(sheet_id, Pos { x: 1, y: 0 }, "1".into(), None);
        gc.set_cell_value(sheet_id, Pos { x: 1, y: 1 }, "2".into(), None);
        gc.set_cell_value(sheet_id, Pos { x: 1, y: 2 }, "3".into(), None);

        // value to cause the spill
        gc.set_cell_code(
            sheet_id,
            Pos { x: 0, y: 0 },
            CodeCellLanguage::Formula,
            "B0:B3".into(),
            None,
        );

        let sheet = gc.grid.sheet_from_id(sheet_id);
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 0, y: 0 }));
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
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 0, y: 1 }));
        assert_eq!(
            render_cells,
            vec![JsRenderCell {
                x: 0,
                y: 1,
                language: None,
                value: "2".into(),
                align: Some(CellAlign::Right),
                wrap: None,
                bold: None,
                italic: None,
                text_color: None
            }]
        );

        gc.set_cell_code(
            sheet_id,
            Pos { x: 0, y: 1 },
            CodeCellLanguage::Formula,
            "1 + 2".into(),
            None,
        );

        // should be spilled because of the code_cell
        let sheet = gc.grid.sheet_from_id(sheet_id);
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 0, y: 0 }));
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
    }
}
