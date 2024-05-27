//! This module contains the implementation for changing formats within the
//! Grid. These functions use the newer Operation::SetCellFormatsSelection,
//! which provide formats for a user-defined selection.

use wasm_bindgen::JsValue;

use crate::{
    controller::{
        active_transactions::transaction_name::TransactionName, operations::operation::Operation,
        GridController,
    },
    grid::{
        formats::{FormatUpdate, Formats},
        CellAlign,
    },
    selection::Selection,
};

impl GridController {
    pub(crate) fn set_cell_align_selection(
        &mut self,
        selection: Selection,
        align: CellAlign,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let formats = Formats::repeat(
            FormatUpdate {
                align: Some(Some(align)),
                ..Default::default()
            },
            selection.count(),
        );
        let ops = vec![Operation::SetCellFormatsSelection { selection, formats }];
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }
}

#[cfg(test)]
mod test {
    use crate::{controller::GridController, selection::Selection, Rect};

    #[test]
    fn test_set_cell_align_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_align_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            crate::grid::CellAlign::Center,
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.columns.get(&0).unwrap().align.get(0),
            Some(crate::grid::CellAlign::Center)
        );
    }
}
