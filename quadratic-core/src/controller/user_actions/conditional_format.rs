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
        js_types::JsHashesDirty,
        sheet::conditional_format::{
            ConditionalFormat, ConditionalFormatConfig, ConditionalFormatConfigUpdate,
            ConditionalFormatUpdate,
        },
    },
};

/// UUID used for new conditional format previews (when id is None).
/// This is a fixed UUID so that repeated previews during editing
/// are treated as the same preview rather than accumulating.
const PREVIEW_UUID: &str = "00000000-0000-0000-0000-000000000000";

impl GridController {
    /// Parses a config update into a config, returning None if parsing fails.
    fn parse_config_update(
        &self,
        config_update: ConditionalFormatConfigUpdate,
        sheet_id: SheetId,
        selection: &A1Selection,
    ) -> Option<ConditionalFormatConfig> {
        match config_update {
            ConditionalFormatConfigUpdate::Formula { rule, style } => {
                let pos = selection.cursor.to_sheet_pos(sheet_id);
                let formula = parse_formula(&rule, self.a1_context(), pos).ok()?;
                Some(ConditionalFormatConfig::Formula {
                    rule: formula,
                    style,
                })
            }
            ConditionalFormatConfigUpdate::ColorScale { color_scale } => {
                Some(ConditionalFormatConfig::ColorScale { color_scale })
            }
        }
    }

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

        // Parse the config
        let config = match self.parse_config_update(update.config, sheet_id, &selection) {
            Some(c) => c,
            None => return, // Invalid config, don't save
        };

        let id = update.id.unwrap_or_else(Uuid::new_v4);

        let conditional_format = ConditionalFormat {
            id,
            selection,
            config,
            apply_to_blank: update.apply_to_blank,
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

            // Parse the config
            let config = match self.parse_config_update(update.config, sheet_id, &selection) {
                Some(c) => c,
                None => {
                    errors.push("Invalid config".to_string());
                    continue;
                }
            };

            let id = update.id.unwrap_or_else(Uuid::new_v4);

            let conditional_format = ConditionalFormat {
                id,
                selection,
                config,
                apply_to_blank: update.apply_to_blank,
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

    /// Sets a preview conditional format for live preview while editing.
    /// This is transient and not persisted or added to undo history.
    /// Triggers a re-render of affected cells (both fills and text styles).
    pub fn set_preview_conditional_format(
        &mut self,
        update: ConditionalFormatUpdate,
    ) -> Result<(), String> {
        let sheet_id =
            SheetId::from_str(&update.sheet_id).map_err(|e| format!("Invalid sheet_id: {e}"))?;

        // Check that sheet exists
        if self.try_sheet(sheet_id).is_none() {
            return Err("Sheet not found".to_string());
        }

        // Parse the selection string into A1Selection (before mutable borrow)
        let a1_context = self.a1_context();
        let selection = A1Selection::parse_a1(&update.selection, sheet_id, a1_context)
            .map_err(|e| format!("Invalid selection: {e}"))?;

        // Parse the config
        let config = self
            .parse_config_update(update.config, sheet_id, &selection)
            .ok_or("Invalid config")?;

        // Use the provided ID (for editing existing formats) or the fixed preview UUID
        let id = update.id.unwrap_or_else(|| {
            Uuid::from_str(PREVIEW_UUID).expect("PREVIEW_UUID should be valid")
        });

        // Get the old selection (if updating an existing preview) so we can mark it dirty too
        let old_selection = self
            .try_sheet(sheet_id)
            .and_then(|s| s.preview_conditional_format.as_ref())
            .map(|p| p.selection.clone());

        let preview = ConditionalFormat {
            id,
            selection: selection.clone(),
            config,
            apply_to_blank: update.apply_to_blank,
        };

        // Now get mutable borrow and set the preview
        if let Some(sheet) = self.try_sheet_mut(sheet_id) {
            sheet.preview_conditional_format = Some(preview);
            // Clear color scale cache since the preview may affect threshold calculations
            sheet.clear_color_scale_cache();
        }

        // Trigger re-render for fills (via jsSheetConditionalFormats -> client clears fill cache)
        let a1_context = self.a1_context();
        if let Some(sheet) = self.try_sheet(sheet_id) {
            sheet.send_all_conditional_formats(a1_context);

            // Also mark cell hashes dirty for text style re-rendering
            // This reuses the same logic as execute_set_conditional_format
            let mut dirty_hashes = selection.rects_to_hashes(sheet, a1_context);
            if let Some(old_sel) = old_selection {
                dirty_hashes.extend(old_sel.rects_to_hashes(sheet, a1_context));
            }

            if !dirty_hashes.is_empty() {
                let js_dirty = vec![JsHashesDirty {
                    sheet_id,
                    hashes: dirty_hashes.into_iter().collect(),
                }];
                if let Ok(data) = serde_json::to_vec(&js_dirty) {
                    crate::wasm_bindings::js::jsHashesDirty(data);
                }
            }
        }

        Ok(())
    }

    /// Clears the preview conditional format and triggers a re-render.
    pub fn clear_preview_conditional_format(&mut self, sheet_id: SheetId) {
        // Get the old selection before clearing so we can mark it dirty
        let old_selection = self
            .try_sheet(sheet_id)
            .and_then(|s| s.preview_conditional_format.as_ref())
            .map(|p| p.selection.clone());

        if let Some(sheet) = self.try_sheet_mut(sheet_id) {
            sheet.preview_conditional_format = None;
            // Clear color scale cache since the preview may have affected threshold calculations
            sheet.clear_color_scale_cache();
        }

        if let Some(old_sel) = old_selection {
            // Trigger re-render for fills
            let a1_context = self.a1_context();
            if let Some(sheet) = self.try_sheet(sheet_id) {
                sheet.send_all_conditional_formats(a1_context);

                // Also mark cell hashes dirty for text style re-rendering
                let dirty_hashes = old_sel.rects_to_hashes(sheet, a1_context);
                if !dirty_hashes.is_empty() {
                    let js_dirty = vec![JsHashesDirty {
                        sheet_id,
                        hashes: dirty_hashes.into_iter().collect(),
                    }];
                    if let Ok(data) = serde_json::to_vec(&js_dirty) {
                        crate::wasm_bindings::js::jsHashesDirty(data);
                    }
                }
            }
        }
    }
}
