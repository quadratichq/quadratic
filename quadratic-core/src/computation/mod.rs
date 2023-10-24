pub mod eval_formula;
pub mod get_cells;
pub mod transaction_in_progress;

use std::collections::HashSet;

use indexmap::IndexSet;

use crate::grid::{CellRef, CodeCellLanguage, CodeCellValue, SheetId};

use crate::controller::{
    operation::Operation, transaction_summary::TransactionSummary, transactions::TransactionType,
};

// only one InProgressTransaction can exist at a time (or no Transaction)

#[derive(Debug, Default, Clone)]
pub struct TransactionInProgress {
    reverse_operations: Vec<Operation>,
    cells_to_compute: IndexSet<CellRef>,
    pub cursor: Option<String>,
    cells_accessed: Vec<CellRef>,
    pub summary: TransactionSummary,
    sheets_with_changed_bounds: HashSet<SheetId>,
    pub transaction_type: TransactionType,

    // save code_cell info for async calls
    current_code_cell: Option<CodeCellValue>,
    pub current_cell_ref: Option<CellRef>,
    waiting_for_async: Option<CodeCellLanguage>,
    // true when transaction completes
    pub complete: bool,
}
