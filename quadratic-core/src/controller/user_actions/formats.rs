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
    use crate::{controller::GridController, selection::Selection};

    #[test]
    fn test_set_cell_align_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_align_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: None,
                rows: Some(vec![0]),
                columns: None,
                all: false,
            },
            crate::grid::CellAlign::Center,
            None,
        )
        .unwrap();
    }
}
