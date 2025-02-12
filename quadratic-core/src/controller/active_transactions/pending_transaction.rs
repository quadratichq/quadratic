//! This module provides a pending transaction
//!
//! It is responsible for:
//! * tracking the state of a pending transaction
//! * converting pending transaction to a completed transaction

use std::collections::{HashMap, HashSet, VecDeque};

use uuid::Uuid;

use crate::{
    a1::A1Selection,
    controller::{
        execution::TransactionSource, operations::operation::Operation, transaction::Transaction,
    },
    grid::{
        js_types::JsValidationWarning, sheet::validations::validation::Validation, CellsAccessed,
        CodeCellLanguage, Sheet, SheetId,
    },
    renderer_constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    Pos, SheetPos, SheetRect,
};

use super::transaction_name::TransactionName;

// validations warnings for a sheet (pos -> JsValidationWarning)
type SheetValidationsWarnings = HashMap<Pos, JsValidationWarning>;

// offsets modified ((column, row) -> new_size)
type SheetOffsets = HashMap<(Option<i64>, Option<i64>), f64>;

// todo: add sheet bounds to this list

#[derive(Debug, Clone, PartialEq)]
pub struct PendingTransaction {
    pub id: Uuid,

    /// a name for the transaction for user display purposes
    pub transaction_name: TransactionName,

    /// Previous selection, represented as a serialized `` cursor sent as part of this transaction
    pub cursor: Option<String>,

    pub source: TransactionSource,

    /// pending operations
    pub operations: VecDeque<Operation>,

    /// undo operations
    pub reverse_operations: Vec<Operation>,

    /// list of operations to share with other players
    pub forward_operations: Vec<Operation>,

    /// tracks whether there are any async calls (which changes how the transaction is finalized)
    pub has_async: i64,

    /// used by Code Cell execution to track dependencies
    pub cells_accessed: CellsAccessed,

    /// save code_cell info for async calls
    pub current_sheet_pos: Option<SheetPos>,

    /// whether we are awaiting an async call
    pub waiting_for_async: Option<CodeCellLanguage>,

    /// whether transaction is complete
    pub complete: bool,

    /// whether to generate a thumbnail after transaction completes
    pub generate_thumbnail: bool,

    /// cursor saved for an Undo or Redo
    pub cursor_undo_redo: Option<String>,

    /// sheets w/updated validations
    pub validations: HashSet<SheetId>,

    /// sheets w/updated validations warnings
    pub validations_warnings: HashMap<SheetId, SheetValidationsWarnings>,

    /// sheets w/updated rows to resize
    pub resize_rows: HashMap<SheetId, HashSet<i64>>,

    /// which hashes are dirty
    pub dirty_hashes: HashMap<SheetId, HashSet<Pos>>,

    /// sheets with updated borders
    pub sheet_borders: HashSet<SheetId>,

    /// code cells to update
    pub code_cells: HashMap<SheetId, HashSet<Pos>>,

    /// html cells to update
    pub html_cells: HashMap<SheetId, HashSet<Pos>>,

    /// image cells to update
    pub image_cells: HashMap<SheetId, HashSet<Pos>>,

    /// sheets w/updated fill cells
    pub fill_cells: HashSet<SheetId>,

    /// sheets w/updated offsets
    pub sheet_info: HashSet<SheetId>,

    // offsets modified (sheet_id -> SheetOffsets)
    pub offsets_modified: HashMap<SheetId, SheetOffsets>,

    // update selection after transaction completes
    pub update_selection: Option<String>,
}

impl Default for PendingTransaction {
    fn default() -> Self {
        PendingTransaction {
            id: Uuid::new_v4(),
            transaction_name: TransactionName::Unknown,
            source: TransactionSource::User,
            cursor: None,
            operations: VecDeque::new(),
            reverse_operations: Vec::new(),
            forward_operations: Vec::new(),
            has_async: 0,
            cells_accessed: Default::default(),
            current_sheet_pos: None,
            waiting_for_async: None,
            complete: false,
            generate_thumbnail: false,
            cursor_undo_redo: None,
            validations: HashSet::new(),
            validations_warnings: HashMap::new(),
            resize_rows: HashMap::new(),
            dirty_hashes: HashMap::new(),
            sheet_borders: HashSet::new(),
            code_cells: HashMap::new(),
            html_cells: HashMap::new(),
            image_cells: HashMap::new(),
            fill_cells: HashSet::new(),
            sheet_info: HashSet::new(),
            offsets_modified: HashMap::new(),
            update_selection: None,
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
                    dbgjs!(&self.forward_operations);
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

    /// Returns whether the transaction is from the server.
    pub fn is_server(&self) -> bool {
        self.source == TransactionSource::Server
    }

    /// Returns whether the transaction is from an action directly performed by
    /// the local user; i.e., whether it is `User` or `Unsaved`. This does not
    /// include undo/redo.
    pub fn is_user(&self) -> bool {
        self.source == TransactionSource::User || self.source == TransactionSource::Unsaved
    }

    /// Returns whether the transaction is from an undo/redo.
    pub fn is_undo_redo(&self) -> bool {
        self.source == TransactionSource::Undo || self.source == TransactionSource::Redo
    }

    /// Returns whether the transaction is from the local user, including
    /// undo/redo.
    pub fn is_user_undo_redo(&self) -> bool {
        self.is_user() || self.is_undo_redo()
    }

    /// Returns whether the transaction is from another multiplayer user.
    pub fn is_multiplayer(&self) -> bool {
        self.source == TransactionSource::Multiplayer
    }

    pub fn add_dirty_hashes_from_sheet_cell_positions(
        &mut self,
        sheet_id: SheetId,
        positions: HashSet<Pos>,
    ) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

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
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        let hashes = sheet_rect.to_hashes();
        let dirty_hashes = self.dirty_hashes.entry(sheet_rect.sheet_id).or_default();
        dirty_hashes.extend(hashes);
    }

    // Adds dirty hashes for all hashes from col_start to col_end (goes to sheet bounds if not provided)
    pub fn add_dirty_hashes_from_sheet_columns(
        &mut self,
        sheet: &Sheet,
        col_start: i64,
        col_end: Option<i64>,
    ) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        let col_end = col_end.unwrap_or(sheet.bounds(true).last_column().unwrap_or(col_start));
        let dirty_hashes = self.dirty_hashes.entry(sheet.id).or_default();
        for col in col_start..=col_end {
            if let Some((start, end)) = sheet.column_bounds(col, false) {
                // round down to the nearest hash y
                let start = start.div_euclid(CELL_SHEET_HEIGHT as _) * CELL_SHEET_HEIGHT as i64;
                for y in (start..=end).step_by(CELL_SHEET_HEIGHT as usize) {
                    let mut pos = Pos { x: col, y };
                    pos.to_quadrant();
                    dirty_hashes.insert(pos);
                }
            }
        }
    }

    // Adds dirty hashes for all hashes from row_start to row_end (goes to sheet bounds if not provided)
    pub fn add_dirty_hashes_from_sheet_rows(
        &mut self,
        sheet: &Sheet,
        row_start: i64,
        row_end: Option<i64>,
    ) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        let row_end = row_end.unwrap_or(sheet.bounds(true).last_row().unwrap_or(row_start));
        let dirty_hashes = self.dirty_hashes.entry(sheet.id).or_default();
        for row in row_start..=row_end {
            if let Some((start, end)) = sheet.row_bounds(row, true) {
                // round down to the nearest hash x
                let start = start.div_euclid(CELL_SHEET_WIDTH as _) * CELL_SHEET_WIDTH as i64;
                for x in (start..=end).step_by(CELL_SHEET_WIDTH as usize) {
                    let mut pos = Pos { x, y: row };
                    pos.to_quadrant();
                    dirty_hashes.insert(pos);
                }
            }
        }
    }

    /// Adds a code cell, html cell and image cell to the transaction from a
    /// CodeRun. If the code_cell no longer exists, then it sends the empty code
    /// cell so the client can remove it.
    pub fn add_from_code_run(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        is_image: bool,
        is_html: bool,
    ) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        self.add_code_cell(sheet_id, pos);

        if is_html {
            self.add_html_cell(sheet_id, pos);
        }

        if is_image {
            self.add_image_cell(sheet_id, pos);
        }
    }

    /// Adds a code cell to the transaction
    pub fn add_code_cell(&mut self, sheet_id: SheetId, pos: Pos) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        self.code_cells.entry(sheet_id).or_default().insert(pos);
    }

    /// Adds an html cell to the transaction
    pub fn add_html_cell(&mut self, sheet_id: SheetId, pos: Pos) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        self.html_cells.entry(sheet_id).or_default().insert(pos);
    }

    /// Adds an image cell to the transaction
    pub fn add_image_cell(&mut self, sheet_id: SheetId, pos: Pos) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        self.image_cells.entry(sheet_id).or_default().insert(pos);
    }

    /// Adds dirty hashes for all hashes from a list of selections.
    pub fn add_dirty_hashes_from_selections(
        &mut self,
        sheet: &Sheet,
        selections: Vec<A1Selection>,
    ) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        let context = sheet.a1_context();
        selections.iter().for_each(|selection| {
            let dirty_hashes = selection.rects_to_hashes(sheet, &context);
            self.dirty_hashes
                .entry(sheet.id)
                .or_default()
                .extend(dirty_hashes);
        });
    }

    /// Inserts the changed validations into PendingTransaction. Also returns an
    /// A1Selection that can be used to insert changed hashes (we cannot do that
    /// here b/c we need &Sheet, and cannot borrow &Sheet and Sheet.validations
    /// at the same time).
    pub fn validation_changed(
        &mut self,
        sheet_id: SheetId,
        validation: &Validation,
        changed_selection: Option<&A1Selection>,
    ) -> Vec<A1Selection> {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return vec![];
        }

        let mut changed_selections = Vec::new();
        self.validations.insert(sheet_id);
        if validation.render_special().is_some() {
            changed_selections.push(validation.selection.clone());
            if let Some(changed_selection) = changed_selection {
                changed_selections.push(changed_selection.clone());
            }
        }
        changed_selections
    }

    pub fn validation_warning_added(&mut self, sheet_id: SheetId, warning: JsValidationWarning) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        self.validations_warnings
            .entry(sheet_id)
            .or_default()
            .insert(
                Pos {
                    x: warning.x,
                    y: warning.y,
                },
                warning,
            );
    }

    pub fn validation_warning_deleted(&mut self, sheet_id: SheetId, pos: Pos) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        self.validations_warnings
            .entry(sheet_id)
            .or_default()
            .insert(
                pos,
                JsValidationWarning {
                    x: pos.x,
                    y: pos.y,
                    style: None,
                    validation: None,
                },
            );
    }

    /// Updates the offsets modified for a column or row.
    pub fn offsets_modified(
        &mut self,
        sheet_id: SheetId,
        column: Option<i64>,
        row: Option<i64>,
        size: Option<f64>,
    ) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        let offsets_modified = self.offsets_modified.entry(sheet_id).or_default();
        if let Some(column) = column {
            offsets_modified.insert((Some(column), None), size.unwrap_or(0.0));
        }
        if let Some(row) = row {
            offsets_modified.insert((None, Some(row)), size.unwrap_or(0.0));
        }
    }

    /// Adds an updated selection to the transaction
    pub fn add_update_selection(&mut self, selection: A1Selection) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        if let Ok(json) = serde_json::to_string(&selection) {
            self.update_selection = Some(json);
        }
    }

    pub fn add_updates_from_transaction(&mut self, transaction: PendingTransaction) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        self.generate_thumbnail |= transaction.generate_thumbnail;

        self.validations.extend(transaction.validations);

        for (sheet_id, dirty_hashes) in transaction.dirty_hashes {
            self.dirty_hashes
                .entry(sheet_id)
                .or_default()
                .extend(dirty_hashes);
        }

        self.sheet_borders.extend(transaction.sheet_borders);

        for (sheet_id, code_cells) in transaction.code_cells {
            self.code_cells
                .entry(sheet_id)
                .or_default()
                .extend(code_cells);
        }

        for (sheet_id, html_cells) in transaction.html_cells {
            self.html_cells
                .entry(sheet_id)
                .or_default()
                .extend(html_cells);
        }

        for (sheet_id, image_cells) in transaction.image_cells {
            self.image_cells
                .entry(sheet_id)
                .or_default()
                .extend(image_cells);
        }

        self.fill_cells.extend(transaction.fill_cells);

        self.sheet_info.extend(transaction.sheet_info);

        for (sheet_id, offsets_modified) in transaction.offsets_modified {
            self.offsets_modified
                .entry(sheet_id)
                .or_default()
                .extend(offsets_modified);
        }
    }

    /// Adds a sheet id to the fill cells set.
    pub fn add_fill_cells(&mut self, sheet_id: SheetId) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        self.fill_cells.insert(sheet_id);
    }

    /// Adds a sheet id to the borders set.
    pub fn add_borders(&mut self, sheet_id: SheetId) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        self.sheet_borders.insert(sheet_id);
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::{
        controller::operations::operation::Operation,
        grid::{CodeRun, DataTable, DataTableKind, Sheet, SheetId},
        CellValue, Value,
    };

    use super::*;

    #[test]
    fn test_to_transaction() {
        let sheet_id = SheetId::new();
        let name = "Sheet1".to_string();

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
    fn is_user() {
        let transaction = PendingTransaction {
            source: TransactionSource::User,
            ..Default::default()
        };
        assert!(transaction.is_user());

        let transaction = PendingTransaction {
            source: TransactionSource::Unsaved,
            ..Default::default()
        };
        assert!(transaction.is_user());

        let transaction = PendingTransaction {
            source: TransactionSource::Server,
            ..Default::default()
        };
        assert!(!transaction.is_user());
    }

    #[test]
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
    fn test_add_from_code_run() {
        let mut transaction = PendingTransaction::default();
        let sheet_id = SheetId::new();
        let pos = Pos { x: 0, y: 0 };

        transaction.add_from_code_run(sheet_id, pos, false, false);
        assert_eq!(transaction.code_cells.len(), 1);
        assert_eq!(transaction.html_cells.len(), 0);
        assert_eq!(transaction.image_cells.len(), 0);

        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: None,
            line_number: None,
            output_type: None,
        };

        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Single(CellValue::Html("html".to_string())),
            false,
            false,
            true,
            None,
        );
        transaction.add_from_code_run(sheet_id, pos, data_table.is_image(), data_table.is_html());
        assert_eq!(transaction.code_cells.len(), 1);
        assert_eq!(transaction.html_cells.len(), 1);
        assert_eq!(transaction.image_cells.len(), 0);

        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: None,
            line_number: None,
            output_type: None,
        };

        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Single(CellValue::Image("image".to_string())),
            false,
            false,
            true,
            None,
        );
        transaction.add_from_code_run(sheet_id, pos, data_table.is_image(), data_table.is_html());
        assert_eq!(transaction.code_cells.len(), 1);
        assert_eq!(transaction.html_cells.len(), 1);
        assert_eq!(transaction.image_cells.len(), 1);
    }

    #[test]
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
    fn test_add_image_cell() {
        let mut transaction = PendingTransaction::default();
        let sheet_id = SheetId::new();
        let pos = Pos { x: 0, y: 0 };
        transaction.add_image_cell(sheet_id, pos);
        assert_eq!(transaction.image_cells.len(), 1);
        assert_eq!(transaction.image_cells[&sheet_id].len(), 1);
    }

    #[test]
    fn test_offsets_modified() {
        let mut transaction = PendingTransaction::default();
        let sheet_id = SheetId::new();
        transaction.offsets_modified(sheet_id, Some(1), None, Some(10.0));
        assert_eq!(transaction.offsets_modified.len(), 1);
        assert_eq!(transaction.offsets_modified[&sheet_id].len(), 1);
        assert_eq!(
            transaction.offsets_modified[&sheet_id][&(Some(1), None)],
            10.0
        );
        transaction.offsets_modified(sheet_id, None, Some(1), Some(10.0));
        assert_eq!(transaction.offsets_modified[&sheet_id].len(), 2);
        assert_eq!(
            transaction.offsets_modified[&sheet_id][&(None, Some(1))],
            10.0
        );
    }

    #[test]
    fn test_add_dirty_hashes_from_sheet_columns() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos::new(1, 1), "A1".to_string());
        sheet.recalculate_bounds();

        let mut transaction = PendingTransaction::default();
        transaction.add_dirty_hashes_from_sheet_columns(&sheet, 1, None);

        let dirty_hashes = transaction.dirty_hashes.get(&sheet.id).unwrap();
        assert!(dirty_hashes.contains(&Pos { x: 0, y: 0 }));
        assert_eq!(dirty_hashes.len(), 1);
    }

    #[test]
    fn test_add_dirty_hashes_from_sheet_rows() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos::new(1, 1), "A1".to_string());
        sheet.recalculate_bounds();

        let mut transaction = PendingTransaction::default();
        transaction.add_dirty_hashes_from_sheet_rows(&sheet, 1, None);

        let dirty_hashes = transaction.dirty_hashes.get(&sheet.id).unwrap();
        assert!(dirty_hashes.contains(&Pos { x: 0, y: 0 }));
        assert_eq!(dirty_hashes.len(), 1);
    }

    #[test]
    fn test_add_update_selection() {
        let mut transaction = PendingTransaction::default();
        let selection = A1Selection::test_a1("A1:B2");
        transaction.add_update_selection(selection.clone());
        assert_eq!(
            transaction.update_selection,
            Some(serde_json::to_string(&selection).unwrap())
        );
    }

    #[test]
    fn test_add_fill_cells() {
        let mut transaction = PendingTransaction::default();
        let sheet_id = SheetId::new();
        transaction.add_fill_cells(sheet_id);
        assert!(transaction.fill_cells.contains(&sheet_id));
    }

    #[test]
    fn test_add_borders() {
        let mut transaction = PendingTransaction::default();
        let sheet_id = SheetId::new();
        transaction.add_borders(sheet_id);
        assert!(transaction.sheet_borders.contains(&sheet_id));
    }
}
