//! User actions for conditional formatting.

use std::str::FromStr;

use uuid::Uuid;

use crate::{
    a1::A1Selection,
    controller::{
        GridController, active_transactions::transaction_name::TransactionName,
        operations::operation::Operation,
    },
    formulas::parse_formula,
    grid::{
        SheetId,
        sheet::conditional_format::{ConditionalFormat, ConditionalFormatUpdate},
    },
};

impl GridController {
    /// Creates or updates a conditional format.
    pub fn update_conditional_format(
        &mut self,
        update: ConditionalFormatUpdate,
        cursor: Option<String>,
    ) {
        let sheet_id = match SheetId::from_str(&update.sheet_id) {
            Ok(id) => id,
            Err(_) => return,
        };

        let Some(_sheet) = self.try_sheet(sheet_id) else {
            return;
        };

        // Parse the selection string into A1Selection
        let selection = match A1Selection::parse_a1(&update.selection, sheet_id, self.a1_context())
        {
            Ok(s) => s,
            Err(_) => return, // Invalid selection, don't save
        };

        // Parse the formula string into AST
        let pos = selection.cursor.to_sheet_pos(sheet_id);
        let formula = match parse_formula(&update.rule, self.a1_context(), pos) {
            Ok(f) => f,
            Err(_) => return, // Invalid formula, don't save
        };

        let id = update.id.unwrap_or_else(Uuid::new_v4);

        let conditional_format = ConditionalFormat {
            id,
            selection,
            style: update.style,
            rule: formula,
        };

        let ops = vec![Operation::SetConditionalFormat { conditional_format }];
        self.start_user_ai_transaction(ops, cursor, TransactionName::ConditionalFormat, false);
    }

    /// Removes a conditional format.
    pub fn remove_conditional_format(
        &mut self,
        sheet_id: SheetId,
        conditional_format_id: Uuid,
        cursor: Option<String>,
    ) {
        let Some(_sheet) = self.try_sheet(sheet_id) else {
            return;
        };

        let ops = vec![Operation::RemoveConditionalFormat {
            sheet_id,
            conditional_format_id,
        }];
        self.start_user_ai_transaction(ops, cursor, TransactionName::ConditionalFormat, false);
    }

    /// Batch update conditional formats - creates, updates, or deletes multiple
    /// conditional formats in a single transaction. Used by AI tools.
    ///
    /// Returns a Result with error messages for any failed operations, or Ok if all succeeded.
    pub fn batch_update_conditional_formats(
        &mut self,
        sheet_id: SheetId,
        updates: Vec<ConditionalFormatUpdate>,
        delete_ids: Vec<Uuid>,
        cursor: Option<String>,
    ) -> Result<(), String> {
        let Some(_sheet) = self.try_sheet(sheet_id) else {
            return Err("Sheet not found".to_string());
        };

        let mut ops = Vec::new();
        let mut errors = Vec::new();

        // Process updates (creates and updates)
        for update in updates {
            // Parse the selection string into A1Selection
            let selection =
                match A1Selection::parse_a1(&update.selection, sheet_id, self.a1_context()) {
                    Ok(s) => s,
                    Err(e) => {
                        errors.push(format!("Invalid selection '{}': {}", update.selection, e));
                        continue;
                    }
                };

            // Parse the formula string into AST
            let pos = selection.cursor.to_sheet_pos(sheet_id);
            let formula = match parse_formula(&update.rule, self.a1_context(), pos) {
                Ok(f) => f,
                Err(e) => {
                    errors.push(format!("Invalid rule formula '{}': {}", update.rule, e));
                    continue;
                }
            };

            let id = update.id.unwrap_or_else(Uuid::new_v4);

            let conditional_format = ConditionalFormat {
                id,
                selection,
                style: update.style,
                rule: formula,
            };

            ops.push(Operation::SetConditionalFormat { conditional_format });
        }

        // Process deletes
        for conditional_format_id in delete_ids {
            ops.push(Operation::RemoveConditionalFormat {
                sheet_id,
                conditional_format_id,
            });
        }

        if ops.is_empty() && !errors.is_empty() {
            return Err(errors.join("; "));
        }

        if !ops.is_empty() {
            self.start_user_ai_transaction(ops, cursor, TransactionName::ConditionalFormat, false);
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(format!(
                "Some operations failed: {}. Successful operations were applied.",
                errors.join("; ")
            ))
        }
    }
}
