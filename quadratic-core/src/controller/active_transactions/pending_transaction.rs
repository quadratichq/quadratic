//! This module provides a pending transaction
//!
//! It is responsible for:
//! * tracking the state of a pending transaction
//! * converting pending transaction to a completed transaction

use std::collections::{HashMap, HashSet, VecDeque};

use uuid::Uuid;

use crate::{
    controller::{
        execution::TransactionType, operations::operation::Operation, transaction::Transaction,
    },
    grid::{sheet::validations::validation::Validation, CodeCellLanguage, CodeRun, SheetId},
    selection::Selection,
    Pos, SheetPos, SheetRect,
};

use super::transaction_name::TransactionName;

// offsets modified ((column, row) -> new_size)
type SheetOffsets = HashMap<(Option<i64>, Option<i64>), f64>;

#[derive(Debug, Clone, PartialEq)]
pub struct PendingTransaction {
    pub id: Uuid,

    // a name for the transaction for user display purposes
    pub transaction_name: TransactionName,

    // cursor sent as part of this transaction
    pub cursor: Option<String>,

    pub transaction_type: TransactionType,

    // pending operations
    pub operations: VecDeque<Operation>,

    // undo operations
    pub reverse_operations: Vec<Operation>,

    // list of operations to share with other players
    pub forward_operations: Vec<Operation>,

    // tracks whether there are any async calls (which changes how the transaction is finalized)
    pub has_async: i64,

    // used by Code Cell execution to track dependencies
    pub cells_accessed: HashSet<SheetRect>,

    // save code_cell info for async calls
    pub current_sheet_pos: Option<SheetPos>,

    // whether we are awaiting an async call
    pub waiting_for_async: Option<CodeCellLanguage>,

    // whether transaction is complete
    pub complete: bool,

    // whether to generate a thumbnail after transaction completes
    pub generate_thumbnail: bool,

    // cursor saved for an Undo or Redo
    pub cursor_undo_redo: Option<String>,

    // sheets w/updated validations
    pub validations: HashSet<SheetId>,

    pub resize_rows: HashMap<SheetId, HashSet<i64>>,

    // which hashes are dirty
    pub dirty_hashes: HashMap<SheetId, HashSet<Pos>>,

    // sheets with updated borders
    pub sheet_borders: HashSet<SheetId>,

    // code cells to update
    pub code_cells: HashMap<SheetId, HashSet<Pos>>,

    // html cells to update
    pub html_cells: HashMap<SheetId, HashSet<Pos>>,

    // image cells to update
    pub image_cells: HashMap<SheetId, HashSet<Pos>>,

    // sheets w/updated fill cells
    pub fill_cells: HashSet<SheetId>,

    // sheets w/updated offsets
    pub sheet_info: HashSet<SheetId>,

    // offsets modified (sheet_id -> SheetOffsets)
    pub offsets_modified: HashMap<SheetId, SheetOffsets>,
}

impl Default for PendingTransaction {
    fn default() -> Self {
        PendingTransaction {
            id: Uuid::new_v4(),
            transaction_name: TransactionName::Unknown,
            cursor: None,
            transaction_type: TransactionType::User,
            operations: VecDeque::new(),
            reverse_operations: Vec::new(),
            forward_operations: Vec::new(),
            has_async: 0,
            cells_accessed: HashSet::new(),
            current_sheet_pos: None,
            waiting_for_async: None,
            complete: false,
            generate_thumbnail: false,
            cursor_undo_redo: None,
            validations: HashSet::new(),
            resize_rows: HashMap::new(),
            dirty_hashes: HashMap::new(),
            sheet_borders: HashSet::new(),
            code_cells: HashMap::new(),
            html_cells: HashMap::new(),
            image_cells: HashMap::new(),
            fill_cells: HashSet::new(),
            sheet_info: HashSet::new(),
            offsets_modified: HashMap::new(),
        }
    }
}

impl PendingTransaction {
    pub fn to_transaction(&self, sequence_num: Option<u64>) -> Transaction {
        Transaction {
            id: self.id,
            sequence_num,
            operations: self.operations.clone().into(),
            cursor: self.cursor.clone(),
        }
    }

    /// Creates a transaction to share in multiplayer
    pub fn to_forward_transaction(&self) -> Transaction {
        Transaction {
            id: self.id,
            sequence_num: None,
            operations: self.forward_operations.clone(),
            cursor: None,
        }
    }

    /// Creates a transaction to save to the Undo/Redo stack
    pub fn to_undo_transaction(&self) -> Transaction {
        let mut operations = self.reverse_operations.clone();
        operations.reverse();

        Transaction {
            id: self.id,
            sequence_num: None,
            operations,
            cursor: self.cursor.clone(),
        }
    }

    /// Sends the transaction to the multiplayer server (if needed)
    pub fn send_transaction(&self) {
        if self.complete
            && self.is_user_undo_redo()
            && (cfg!(target_family = "wasm") || cfg!(test))
            && !self.is_server()
        {
            let transaction_id = self.id.to_string();

            match Transaction::serialize_and_compress(&self.forward_operations) {
                Ok(ops) => {
                    crate::wasm_bindings::js::jsSendTransaction(transaction_id, ops);
                }
                Err(e) => {
                    dbgjs!(format!("Failed to serialize forward operations: {}", e));
                }
            };

            if self.is_undo_redo() {
                if let Some(cursor) = &self.cursor_undo_redo {
                    crate::wasm_bindings::js::jsSetCursor(cursor.clone());
                }
            }

            if self.generate_thumbnail {
                crate::wasm_bindings::js::jsGenerateThumbnail();
            }
        }
    }

    pub fn is_server(&self) -> bool {
        matches!(self.transaction_type, TransactionType::Server)
    }

    pub fn is_user(&self) -> bool {
        matches!(self.transaction_type, TransactionType::User)
            || matches!(self.transaction_type, TransactionType::Unsaved)
    }

    pub fn is_undo_redo(&self) -> bool {
        matches!(self.transaction_type, TransactionType::Undo)
            || matches!(self.transaction_type, TransactionType::Redo)
    }

    pub fn is_user_undo_redo(&self) -> bool {
        self.is_user() || self.is_undo_redo()
    }

    pub fn is_multiplayer(&self) -> bool {
        matches!(self.transaction_type, TransactionType::Multiplayer)
    }

    pub fn add_dirty_hashes_from_sheet_cell_positions(
        &mut self,
        sheet_id: SheetId,
        positions: HashSet<Pos>,
    ) {
        let mut hashes = HashSet::new();
        positions.iter().for_each(|pos| {
            let quadrant = pos.quadrant();
            hashes.insert(Pos {
                x: quadrant.0,
                y: quadrant.1,
            });
        });

        let dirty_hashes = self.dirty_hashes.entry(sheet_id).or_default();
        dirty_hashes.extend(hashes);
    }

    pub fn add_dirty_hashes_from_sheet_rect(&mut self, sheet_rect: SheetRect) {
        let hashes = sheet_rect.to_hashes();
        let dirty_hashes = self.dirty_hashes.entry(sheet_rect.sheet_id).or_default();
        dirty_hashes.extend(hashes);
    }

    /// Adds a code cell, html cell and image cell to the transaction from a CodeRun
    pub fn add_from_code_run(&mut self, sheet_id: SheetId, pos: Pos, code_run: &Option<CodeRun>) {
        if let Some(code_run) = &code_run {
            self.add_code_cell(sheet_id, pos);
            if code_run.is_html() {
                self.add_html_cell(sheet_id, pos);
            }
            if code_run.is_image() {
                self.add_image_cell(sheet_id, pos);
            }
        }
    }

    /// Adds a code cell to the transaction
    pub fn add_code_cell(&mut self, sheet_id: SheetId, pos: Pos) {
        self.code_cells.entry(sheet_id).or_default().insert(pos);
    }

    /// Adds an html cell to the transaction
    pub fn add_html_cell(&mut self, sheet_id: SheetId, pos: Pos) {
        self.html_cells.entry(sheet_id).or_default().insert(pos);
    }

    /// Adds an image cell to the transaction
    pub fn add_image_cell(&mut self, sheet_id: SheetId, pos: Pos) {
        self.image_cells.entry(sheet_id).or_default().insert(pos);
    }

    /// Updates the dirty hashes for a validation. This includes triggering the
    /// validation changes for a Sheet and any dirty hashes resulting from a
    /// change in a checkbox or dropdown.
    pub fn validation_changed(
        &mut self,
        sheet_id: SheetId,
        validation: &Validation,
        changed_selection: Option<&Selection>,
    ) {
        self.validations.insert(sheet_id);
        if validation.render_special().is_some() {
            let dirty_hashes = validation.selection.rects_to_hashes();
            self.dirty_hashes
                .entry(sheet_id)
                .or_default()
                .extend(dirty_hashes);

            if let Some(changed_selection) = changed_selection {
                let changed_hashes = changed_selection.rects_to_hashes();
                self.dirty_hashes
                    .entry(sheet_id)
                    .or_default()
                    .extend(changed_hashes);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        controller::operations::operation::Operation,
        grid::{CodeRunResult, SheetId},
        CellValue, Value,
    };

    use super::*;
    use chrono::Utc;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_to_transaction() {
        let sheet_id = SheetId::new();
        let name = "Sheet 1".to_string();

        let mut transaction = PendingTransaction::default();
        let forward_operations = vec![
            Operation::SetSheetName {
                sheet_id,
                name: "new name".to_string(),
            },
            Operation::SetSheetColor {
                sheet_id,
                color: Some("red".to_string()),
            },
        ];
        transaction
            .forward_operations
            .clone_from(&forward_operations);
        let reverse_operations = vec![
            Operation::SetSheetName { sheet_id, name },
            Operation::SetSheetColor {
                sheet_id,
                color: None,
            },
        ];
        transaction
            .reverse_operations
            .clone_from(&reverse_operations);
        transaction.reverse_operations.reverse();
        let forward_transaction = transaction.to_forward_transaction();
        assert_eq!(forward_transaction.id, transaction.id);
        assert_eq!(forward_transaction.operations, forward_operations);
        assert_eq!(forward_transaction.sequence_num, None);

        let reverse_transaction = transaction.to_undo_transaction();
        assert_eq!(reverse_transaction.id, transaction.id);
        assert_eq!(reverse_transaction.operations, reverse_operations);
        assert_eq!(reverse_transaction.sequence_num, None);
    }

    #[test]
    #[parallel]
    fn is_user() {
        let transaction = PendingTransaction {
            transaction_type: TransactionType::User,
            ..Default::default()
        };
        assert!(transaction.is_user());

        let transaction = PendingTransaction {
            transaction_type: TransactionType::Unsaved,
            ..Default::default()
        };
        assert!(transaction.is_user());

        let transaction = PendingTransaction {
            transaction_type: TransactionType::Server,
            ..Default::default()
        };
        assert!(!transaction.is_user());
    }

    #[test]
    #[parallel]
    fn test_add_dirty_hashes_from_sheet_cell_positions() {
        let sheet_id = SheetId::new();
        let positions: HashSet<Pos> = vec![Pos { x: 1, y: 1 }, Pos { x: 16, y: 2 }]
            .into_iter()
            .collect();
        let mut transaction = PendingTransaction::default();
        transaction.add_dirty_hashes_from_sheet_cell_positions(sheet_id, positions);
        assert_eq!(transaction.dirty_hashes.len(), 1);
        assert_eq!(transaction.dirty_hashes.get(&sheet_id).unwrap().len(), 2);
        assert!(transaction
            .dirty_hashes
            .get(&sheet_id)
            .unwrap()
            .contains(&Pos { x: 0, y: 0 }));
        assert!(transaction
            .dirty_hashes
            .get(&sheet_id)
            .unwrap()
            .contains(&Pos { x: 1, y: 0 }));
    }

    #[test]
    #[parallel]
    fn test_add_dirty_hashes_from_sheet_rect() {
        let sheet_rect = SheetRect::single_pos(Pos { x: 0, y: 0 }, SheetId::new());
        let mut transaction = PendingTransaction::default();
        transaction.add_dirty_hashes_from_sheet_rect(sheet_rect);
        assert_eq!(transaction.dirty_hashes.len(), 1);
        assert_eq!(
            transaction
                .dirty_hashes
                .get(&sheet_rect.sheet_id)
                .unwrap()
                .len(),
            1
        );
        assert!(transaction
            .dirty_hashes
            .get(&sheet_rect.sheet_id)
            .unwrap()
            .contains(&Pos { x: 0, y: 0 }),);
    }

    #[test]
    #[parallel]
    fn test_add_from_code_run() {
        let mut transaction = PendingTransaction::default();
        let sheet_id = SheetId::new();
        let pos = Pos { x: 0, y: 0 };

        transaction.add_from_code_run(sheet_id, pos, &None);
        assert_eq!(transaction.code_cells.len(), 0);
        assert_eq!(transaction.html_cells.len(), 0);
        assert_eq!(transaction.image_cells.len(), 0);

        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            cells_accessed: HashSet::new(),
            result: CodeRunResult::Ok(Value::Single(CellValue::Html("html".to_string()))),
            return_type: None,
            line_number: None,
            output_type: None,
            spill_error: false,
            last_modified: Utc::now(),
        };
        transaction.add_from_code_run(sheet_id, pos, &Some(code_run));
        assert_eq!(transaction.code_cells.len(), 1);
        assert_eq!(transaction.html_cells.len(), 1);
        assert_eq!(transaction.image_cells.len(), 0);

        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            cells_accessed: HashSet::new(),
            result: CodeRunResult::Ok(Value::Single(CellValue::Image("image".to_string()))),
            return_type: None,
            line_number: None,
            output_type: None,
            spill_error: false,
            last_modified: Utc::now(),
        };
        transaction.add_from_code_run(sheet_id, pos, &Some(code_run));
        assert_eq!(transaction.code_cells.len(), 1);
        assert_eq!(transaction.html_cells.len(), 1);
        assert_eq!(transaction.image_cells.len(), 1);
    }

    #[test]
    #[parallel]
    fn test_add_code_cell() {
        let mut transaction = PendingTransaction::default();
        let sheet_id = SheetId::new();
        let pos = Pos { x: 0, y: 0 };
        transaction.add_code_cell(sheet_id, pos);
        assert_eq!(transaction.code_cells.len(), 1);
        assert_eq!(transaction.code_cells[&sheet_id].len(), 1);
        assert!(transaction.code_cells[&sheet_id].contains(&pos));
    }

    #[test]
    #[parallel]
    fn test_add_html_cell() {
        let mut transaction = PendingTransaction::default();
        let sheet_id = SheetId::new();
        let pos = Pos { x: 0, y: 0 };
        transaction.add_html_cell(sheet_id, pos);
        assert_eq!(transaction.html_cells.len(), 1);
        assert_eq!(transaction.html_cells[&sheet_id].len(), 1);
        assert!(transaction.html_cells[&sheet_id].contains(&pos));
    }

    #[test]
    #[parallel]
    fn test_add_image_cell() {
        let mut transaction = PendingTransaction::default();
        let sheet_id = SheetId::new();
        let pos = Pos { x: 0, y: 0 };
        transaction.add_image_cell(sheet_id, pos);
        assert_eq!(transaction.image_cells.len(), 1);
        assert_eq!(transaction.image_cells[&sheet_id].len(), 1);
    }
}
