//! This module provides a pending transaction
//!
//! It is responsible for:
//! * tracking the state of a pending transaction
//! * converting pending transaction to a completed transaction

use std::collections::{HashMap, HashSet, VecDeque};

use uuid::Uuid;

use crate::{
    Pos, Rect, SheetPos, SheetRect,
    a1::{A1Context, A1Selection},
    controller::{
        execution::TransactionSource, operations::operation::Operation, transaction::Transaction,
    },
    grid::{
        CellsAccessed, GridBounds, Sheet, SheetId, js_types::JsValidationWarning,
        sheet::validations::validation::Validation,
    },
    renderer_constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
};

use super::transaction_name::TransactionName;

// validations warnings for a sheet (pos -> JsValidationWarning)
type SheetValidationsWarnings = HashMap<Pos, JsValidationWarning>;

// offsets modified ((column, row) -> new_size)
type SheetOffsets = HashMap<(Option<i64>, Option<i64>), f64>;

#[derive(Debug, Clone, PartialEq)]
pub struct PendingTransaction {
    pub(crate) id: Uuid,

    /// a name for the transaction for user display purposes
    pub(crate) transaction_name: TransactionName,

    /// Previous selection, represented as a serialized `` cursor sent as part of this transaction
    pub(crate) cursor: Option<String>,

    pub(crate) source: TransactionSource,

    /// pending operations
    pub(crate) operations: VecDeque<Operation>,

    /// undo operations
    pub(crate) reverse_operations: Vec<Operation>,

    /// list of operations to share with other players
    pub(crate) forward_operations: Vec<Operation>,

    /// tracks whether there are any async calls (which changes how the transaction is finalized)
    pub(crate) has_async: i64,

    /// used by Code Cell execution to track dependencies
    pub(crate) cells_accessed: CellsAccessed,

    /// save code_cell info for async calls
    pub current_sheet_pos: Option<SheetPos>,

    /// whether we are awaiting an async call for a code cell
    pub(crate) waiting_for_async_code_cell: bool,

    /// whether transaction is complete
    pub(crate) complete: bool,

    /// whether to generate a thumbnail after transaction completes
    pub(crate) generate_thumbnail: bool,

    /// cursor saved for an Undo or Redo
    pub(crate) cursor_undo_redo: Option<String>,

    /// sheets w/updated validations
    pub(crate) validations: HashSet<SheetId>,

    /// sheets w/updated validations warnings
    pub(crate) validations_warnings: HashMap<SheetId, SheetValidationsWarnings>,

    /// sheets w/updated conditional formats
    pub(crate) conditional_formats: HashSet<SheetId>,

    /// sheets w/updated rows to resize
    pub(crate) resize_rows: HashMap<SheetId, HashSet<i64>>,

    /// which hashes are dirty
    pub(crate) dirty_hashes: HashMap<SheetId, HashSet<Pos>>,

    /// sheets with updated borders
    pub(crate) sheet_borders: HashSet<SheetId>,

    /// code cells to update in a1_context
    pub(crate) code_cells_a1_context: HashMap<SheetId, HashSet<Pos>>,

    /// code cells to update
    pub(crate) code_cells: HashMap<SheetId, HashSet<Pos>>,

    /// html cells to update
    pub(crate) html_cells: HashMap<SheetId, HashSet<Pos>>,

    /// image cells to update
    pub(crate) image_cells: HashMap<SheetId, HashSet<Pos>>,

    /// dirty fill hashes per sheet (hash positions)
    pub(crate) fill_cells: HashMap<SheetId, HashSet<Pos>>,

    /// sheets with updated meta fills (row/column/sheet fills)
    pub(crate) sheet_meta_fills: HashSet<SheetId>,

    /// sheets w/updated info
    pub(crate) sheet_info: HashSet<SheetId>,

    // offsets modified (sheet_id -> SheetOffsets)
    pub(crate) offsets_modified: HashMap<SheetId, SheetOffsets>,

    pub(crate) offsets_reloaded: HashSet<SheetId>,

    // update selection after transaction completes
    pub(crate) update_selection: Option<String>,

    // updates to the content cache per sheet
    pub(crate) sheet_content_cache: HashSet<SheetId>,

    /// sheets that need updated SheetDataTablesCache
    pub(crate) sheet_data_tables_cache: HashSet<SheetId>,

    /// Sheets that need updated MergeCells, with the specific hash positions
    /// that the render worker should invalidate. 
    pub(crate) merge_cells_updates: HashMap<SheetId, HashSet<Pos>>,

    /// Track positions with pending ComputeCode operations for O(1) duplicate checking
    pub(crate) pending_compute_positions: HashSet<SheetPos>,
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
            waiting_for_async_code_cell: false,
            complete: false,
            generate_thumbnail: false,
            cursor_undo_redo: None,
            validations: HashSet::new(),
            validations_warnings: HashMap::new(),
            conditional_formats: HashSet::new(),
            resize_rows: HashMap::new(),
            dirty_hashes: HashMap::new(),
            sheet_borders: HashSet::new(),
            code_cells_a1_context: HashMap::new(),
            code_cells: HashMap::new(),
            html_cells: HashMap::new(),
            image_cells: HashMap::new(),
            fill_cells: HashMap::new(),
            sheet_meta_fills: HashSet::new(),
            sheet_info: HashSet::new(),
            offsets_modified: HashMap::new(),
            offsets_reloaded: HashSet::new(),
            update_selection: None,
            sheet_content_cache: HashSet::new(),
            sheet_data_tables_cache: HashSet::new(),
            merge_cells_updates: HashMap::new(),
            pending_compute_positions: HashSet::new(),
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
            && self.is_user_ai_undo_redo()
            && (cfg!(target_family = "wasm") || cfg!(test))
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

            if self.is_undo_redo()
                && let Some(cursor) = &self.cursor_undo_redo
            {
                crate::wasm_bindings::js::jsSetCursor(cursor.clone());
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
    fn is_user(&self) -> bool {
        self.source == TransactionSource::User || self.source == TransactionSource::Unsaved
    }

    pub fn is_undo(&self) -> bool {
        self.source == TransactionSource::Undo || self.source == TransactionSource::UndoAI
    }

    pub fn is_redo(&self) -> bool {
        self.source == TransactionSource::Redo || self.source == TransactionSource::RedoAI
    }

    fn is_ai(&self) -> bool {
        self.source == TransactionSource::AI
    }

    pub fn is_user_ai(&self) -> bool {
        self.is_user() || self.is_ai()
    }

    /// Returns whether the transaction is from an undo/redo.
    pub fn is_undo_redo(&self) -> bool {
        self.is_undo() || self.is_redo()
    }

    /// Returns whether the transaction is from the local user, including
    /// undo/redo.
    pub fn is_user_ai_undo_redo(&self) -> bool {
        self.is_user_ai() || self.is_undo_redo()
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

        self.add_content_cache(sheet_id);
    }

    pub fn add_dirty_hashes_from_sheet_rect(&mut self, sheet_rect: SheetRect) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        let hashes = sheet_rect.to_hashes();
        let dirty_hashes = self.dirty_hashes.entry(sheet_rect.sheet_id).or_default();
        dirty_hashes.extend(hashes);

        self.add_content_cache(sheet_rect.sheet_id);
    }

    pub fn add_dirty_hashes_from_dirty_code_rects(
        &mut self,
        sheet: &Sheet,
        dirty_rects: HashSet<Rect>,
    ) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        for dirty_rect in dirty_rects {
            self.add_dirty_hashes_from_sheet_rect(dirty_rect.to_sheet_rect(sheet.id));
            if let Some(dt) = sheet.data_table_at(&dirty_rect.min) {
                dt.add_dirty_fills_and_borders(self, sheet.id, dirty_rect.min);
                self.add_from_code_run(sheet.id, dirty_rect.min, dt.is_image(), dt.is_html());
            } else {
                self.add_code_cell(sheet.id, dirty_rect.min);
            }
        }
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

        self.add_content_cache(sheet.id);
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

        self.add_content_cache(sheet.id);
    }

    /// Adds dirty hashes for all hashes from a list of selections.
    pub fn add_dirty_hashes_from_selections(
        &mut self,
        sheet: &Sheet,
        a1_context: &A1Context,
        selections: Vec<A1Selection>,
    ) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        selections.iter().for_each(|selection| {
            let dirty_hashes = selection.rects_to_hashes(sheet, a1_context);
            self.dirty_hashes
                .entry(sheet.id)
                .or_default()
                .extend(dirty_hashes);
        });
    }

    /// Adds a code cell to the transaction
    pub fn add_code_cell(&mut self, sheet_id: SheetId, pos: Pos) {
        self.code_cells_a1_context
            .entry(sheet_id)
            .or_default()
            .insert(pos);

        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        self.sheet_data_tables_cache.insert(sheet_id);

        self.code_cells.entry(sheet_id).or_default().insert(pos);
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
        self.add_code_cell(sheet_id, pos);

        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        if is_html {
            self.html_cells.entry(sheet_id).or_default().insert(pos);
        }

        if is_image {
            self.image_cells.entry(sheet_id).or_default().insert(pos);
        }
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
            .insert(warning.pos, warning);
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
                    pos,
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

    /// Adds dirty fill hashes from a sheet rect.
    pub fn add_fill_cells_from_sheet_rect(&mut self, sheet_rect: SheetRect) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        let hashes = sheet_rect.to_hashes();
        self.fill_cells
            .entry(sheet_rect.sheet_id)
            .or_default()
            .extend(hashes);
    }

    /// Adds dirty fill hashes from a rect.
    pub fn add_fill_cells(&mut self, sheet_id: SheetId, rect: Rect) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        let hashes = rect.to_sheet_rect(sheet_id).to_hashes();
        self.fill_cells.entry(sheet_id).or_default().extend(hashes);
    }

    /// Adds dirty fill hashes from a list of selections.
    /// Uses finitize_selection to handle unbounded selections (like column "A").
    pub fn add_fill_cells_from_selections(
        &mut self,
        sheet: &Sheet,
        a1_context: &A1Context,
        selections: Vec<A1Selection>,
    ) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        selections.iter().for_each(|selection| {
            let fill_hashes = selection.rects_to_hashes(sheet, a1_context);
            self.fill_cells
                .entry(sheet.id)
                .or_default()
                .extend(fill_hashes);
        });
    }

    /// Marks all fills for a sheet as dirty (for operations like add sheet that affect entire sheet).
    pub fn add_all_fill_cells(&mut self, sheet: &Sheet) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        // Use bounds(false) to include formatting since fills are part of formatting
        if let GridBounds::NonEmpty(rect) = sheet.bounds(false) {
            self.fill_cells
                .entry(sheet.id)
                .or_default()
                .extend(rect.to_hashes());
        }
    }

    /// Adds dirty fill hashes from a column range to end of sheet.
    pub fn add_fill_cells_from_columns(&mut self, sheet: &Sheet, start_column: i64) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        // Use bounds(false) to include formatting since fills are part of formatting
        if let GridBounds::NonEmpty(bounds_rect) = sheet.bounds(false) {
            // Create rect from start_column to end of bounds
            let rect = Rect::new(
                start_column,
                bounds_rect.min.y,
                bounds_rect.max.x,
                bounds_rect.max.y,
            );
            self.fill_cells
                .entry(sheet.id)
                .or_default()
                .extend(rect.to_hashes());
        }
    }

    /// Adds dirty fill hashes from a row range to end of sheet.
    pub fn add_fill_cells_from_rows(&mut self, sheet: &Sheet, start_row: i64) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        // Use bounds(false) to include formatting since fills are part of formatting
        if let GridBounds::NonEmpty(bounds_rect) = sheet.bounds(false) {
            // Create rect from start_row to end of bounds
            let rect = Rect::new(
                bounds_rect.min.x,
                start_row,
                bounds_rect.max.x,
                bounds_rect.max.y,
            );
            self.fill_cells
                .entry(sheet.id)
                .or_default()
                .extend(rect.to_hashes());
        }
    }

    /// Marks meta fills (row/column/sheet fills) as needing update for a sheet.
    pub fn add_sheet_meta_fills(&mut self, sheet_id: SheetId) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        self.sheet_meta_fills.insert(sheet_id);
    }

    /// Adds a sheet id to the borders set.
    pub fn add_borders(&mut self, sheet_id: SheetId) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        self.sheet_borders.insert(sheet_id);
    }

    pub fn add_content_cache(&mut self, sheet_id: SheetId) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        self.sheet_content_cache.insert(sheet_id);
    }

    /// Marks merge cell hashes as dirty from a list of affected rects.
    pub fn add_merge_cells_dirty_hashes(&mut self, sheet_id: SheetId, affected_rects: &[Rect]) {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || self.is_server() {
            return;
        }

        let merge_hashes = self.merge_cells_updates.entry(sheet_id).or_default();
        for rect in affected_rects {
            merge_hashes.extend(rect.to_hashes());
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        CellValue, Value,
        controller::operations::operation::Operation,
        grid::{CodeCellLanguage, CodeRun, DataTable, DataTableKind, Sheet, SheetId},
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
                old_sheet_name: None,
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
            Operation::SetSheetName {
                sheet_id,
                name,
                old_sheet_name: None,
            },
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
    fn is_ai() {
        let transaction = PendingTransaction {
            source: TransactionSource::AI,
            ..Default::default()
        };
        assert!(transaction.is_ai());

        let transaction = PendingTransaction {
            source: TransactionSource::User,
            ..Default::default()
        };
        assert!(!transaction.is_ai());
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
        assert!(
            transaction
                .dirty_hashes
                .get(&sheet_id)
                .unwrap()
                .contains(&Pos { x: 0, y: 0 })
        );
        assert!(
            transaction
                .dirty_hashes
                .get(&sheet_id)
                .unwrap()
                .contains(&Pos { x: 1, y: 0 })
        );
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
        assert!(
            transaction
                .dirty_hashes
                .get(&sheet_rect.sheet_id)
                .unwrap()
                .contains(&Pos { x: 0, y: 0 }),
        );
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
            language: CodeCellLanguage::Python,
            code: "".to_string(),
            formula_ast: None,
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
            Some(true),
            Some(true),
            None,
        );
        transaction.add_from_code_run(sheet_id, pos, data_table.is_image(), data_table.is_html());
        assert_eq!(transaction.code_cells.len(), 1);
        assert_eq!(transaction.html_cells.len(), 1);
        assert_eq!(transaction.image_cells.len(), 0);

        let code_run = CodeRun {
            language: CodeCellLanguage::Javascript,
            code: "".to_string(),
            formula_ast: None,
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
            Some(true),
            Some(true),
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
        sheet.set_value(pos![1, 1], "A1".to_string());
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction::default();
        transaction.add_dirty_hashes_from_sheet_columns(&sheet, 1, None);

        let dirty_hashes = transaction.dirty_hashes.get(&sheet.id).unwrap();
        assert!(dirty_hashes.contains(&Pos { x: 0, y: 0 }));
        assert_eq!(dirty_hashes.len(), 1);
    }

    #[test]
    fn test_add_dirty_hashes_from_sheet_rows() {
        let mut sheet = Sheet::test();
        sheet.set_value(pos![1, 1], "A1".to_string());
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

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
        let rect = Rect::from_numbers(0, 0, 10, 10);
        transaction.add_fill_cells(sheet_id, rect);
        assert!(transaction.fill_cells.contains_key(&sheet_id));
        assert!(!transaction.fill_cells[&sheet_id].is_empty());
    }

    #[test]
    fn test_add_borders() {
        let mut transaction = PendingTransaction::default();
        let sheet_id = SheetId::new();
        transaction.add_borders(sheet_id);
        assert!(transaction.sheet_borders.contains(&sheet_id));
    }

    #[test]
    fn test_add_all_fill_cells() {
        let mut sheet = Sheet::test();
        // Place cells to create bounds spanning multiple hashes
        // CELL_SHEET_WIDTH = 15, CELL_SHEET_HEIGHT = 30
        sheet.set_value(pos![1, 1], "A".to_string()); // In hash (0, 0)
        sheet.set_value(pos![20, 40], "B".to_string()); // In hash (1, 1)
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction::default();
        transaction.add_all_fill_cells(&sheet);

        let fill_cells = transaction.fill_cells.get(&sheet.id).unwrap();
        // Should have hashes (0,0), (0,1), (1,0), (1,1)
        assert_eq!(fill_cells.len(), 4);
        assert!(fill_cells.contains(&Pos { x: 0, y: 0 }));
        assert!(fill_cells.contains(&Pos { x: 0, y: 1 }));
        assert!(fill_cells.contains(&Pos { x: 1, y: 0 }));
        assert!(fill_cells.contains(&Pos { x: 1, y: 1 }));
    }

    #[test]
    fn test_add_all_fill_cells_empty_sheet() {
        let sheet = Sheet::test();
        let mut transaction = PendingTransaction::default();
        transaction.add_all_fill_cells(&sheet);

        // Empty sheet should not add any fill cells
        assert!(!transaction.fill_cells.contains_key(&sheet.id));
    }

    #[test]
    fn test_add_fill_cells_from_columns() {
        let mut sheet = Sheet::test();
        // Place cells to create bounds
        sheet.set_value(pos![1, 1], "A".to_string()); // In hash (0, 0)
        sheet.set_value(pos![30, 60], "B".to_string()); // In hash (2, 2)
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction::default();
        transaction.add_fill_cells_from_columns(&sheet, 15);

        let fill_cells = transaction.fill_cells.get(&sheet.id).unwrap();
        // Should have hashes from x=1 to x=2, y=0 to y=2
        // (1,0), (1,1), (1,2), (2,0), (2,1), (2,2)
        assert_eq!(fill_cells.len(), 6);
        assert!(fill_cells.contains(&Pos { x: 1, y: 0 }));
        assert!(fill_cells.contains(&Pos { x: 1, y: 1 }));
        assert!(fill_cells.contains(&Pos { x: 1, y: 2 }));
        assert!(fill_cells.contains(&Pos { x: 2, y: 0 }));
        assert!(fill_cells.contains(&Pos { x: 2, y: 1 }));
        assert!(fill_cells.contains(&Pos { x: 2, y: 2 }));
        // Should NOT contain hash x=0
        assert!(!fill_cells.contains(&Pos { x: 0, y: 0 }));
    }

    #[test]
    fn test_add_fill_cells_from_rows() {
        let mut sheet = Sheet::test();
        // Place cells to create bounds
        sheet.set_value(pos![1, 1], "A".to_string()); // In hash (0, 0)
        sheet.set_value(pos![30, 60], "B".to_string()); // In hash (2, 2)
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction::default();
        transaction.add_fill_cells_from_rows(&sheet, 30);

        let fill_cells = transaction.fill_cells.get(&sheet.id).unwrap();
        // Should have hashes from x=0 to x=2, y=1 to y=2
        // (0,1), (0,2), (1,1), (1,2), (2,1), (2,2)
        assert_eq!(fill_cells.len(), 6);
        assert!(fill_cells.contains(&Pos { x: 0, y: 1 }));
        assert!(fill_cells.contains(&Pos { x: 0, y: 2 }));
        assert!(fill_cells.contains(&Pos { x: 1, y: 1 }));
        assert!(fill_cells.contains(&Pos { x: 1, y: 2 }));
        assert!(fill_cells.contains(&Pos { x: 2, y: 1 }));
        assert!(fill_cells.contains(&Pos { x: 2, y: 2 }));
        // Should NOT contain hash y=0
        assert!(!fill_cells.contains(&Pos { x: 0, y: 0 }));
    }
}
