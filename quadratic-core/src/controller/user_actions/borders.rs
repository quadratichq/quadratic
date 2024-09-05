use crate::{
    controller::{active_transactions::transaction_name::TransactionName, GridController},
    grid::sheet::borders::{BorderSelection, BorderStyle},
    selection::Selection,
};

impl GridController {
    pub fn set_borders_selection(
        &mut self,
        selection: Selection,
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
        cursor: Option<String>,
    ) {
        if let Some(ops) = self.set_borders_selection_operations(selection, border_selection, style)
        {
            self.start_user_transaction(ops, cursor, TransactionName::SetBorders);
        }
    }
}
