use super::operation::Operation;
use crate::{
    a1::A1Selection,
    controller::GridController,
    grid::{formats::FormatUpdate, sheet::borders::BorderSelection},
};

impl GridController {
    /// Generates operations to clear formatting and borders for a selection.
    /// Also clears overlapping conditional formats by removing or updating them.
    ///
    /// If `skip_richtext_clearing` is true, the function will not generate
    /// operations to clear RichText inline formatting. This should be set to
    /// true when the cells are being deleted (since there's no point in
    /// clearing formatting on cells that will be removed, and doing so would
    /// overwrite the deletion with a modified RichText value).
    pub(crate) fn clear_format_borders_operations(
        &self,
        selection: &A1Selection,
        ignore_tables_having_anchoring_cell_in_selection: bool,
        skip_richtext_clearing: bool,
    ) -> Vec<Operation> {
        let mut ops = self.format_ops(
            selection,
            FormatUpdate::cleared(),
            ignore_tables_having_anchoring_cell_in_selection,
            skip_richtext_clearing,
        );
        ops.extend(self.set_borders_a1_selection_operations(
            selection.clone(),
            BorderSelection::All,
            None,
            false,
        ));

        // Also clear overlapping conditional formats
        ops.extend(self.clear_conditional_formats_operations(selection));

        ops
    }

    /// Generates operations to clear conditional formats that overlap with a selection.
    /// If a conditional format's selection completely overlaps, it is removed.
    /// If it partially overlaps, the selection is updated to exclude the cleared area.
    fn clear_conditional_formats_operations(&self, selection: &A1Selection) -> Vec<Operation> {
        let mut ops = Vec::new();

        let Some(sheet) = self.try_sheet(selection.sheet_id) else {
            return ops;
        };

        let a1_context = self.a1_context();

        // Find all conditional formats that overlap with the selection
        let overlapping_formats: Vec<_> = sheet
            .conditional_formats
            .overlaps_selection(selection, a1_context)
            .into_iter()
            .map(|cf| (cf.id, cf.clone()))
            .collect();

        for (cf_id, cf) in overlapping_formats {
            if let Some(new_selection) = cf.selection.delete_selection(selection, a1_context) {
                // If the selection is different, update the conditional format
                if cf.selection != new_selection {
                    let updated_cf = crate::grid::sheet::conditional_format::ConditionalFormat {
                        selection: new_selection,
                        ..cf
                    };
                    ops.push(Operation::SetConditionalFormat {
                        conditional_format: updated_cf,
                    });
                }
            } else {
                // The selection completely overlaps the conditional format - remove it
                ops.push(Operation::RemoveConditionalFormat {
                    sheet_id: selection.sheet_id,
                    conditional_format_id: cf_id,
                });
            }
        }

        ops
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use crate::grid::{
        SheetId,
        formats::SheetFormatUpdates,
        sheet::{
            borders::BorderStyle,
            conditional_format::{
                ConditionalFormat, ConditionalFormatConfig, ConditionalFormatStyle,
            },
        },
    };

    use super::*;

    #[test]
    fn test_clear_format_selection_operations() {
        let mut gc = GridController::test();

        gc.set_borders(
            A1Selection::test_a1("A1"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet_id = SheetId::TEST;
        let selection = A1Selection::test_a1("A1");
        let ops = gc.clear_format_borders_operations(&selection, false, false);

        assert_eq!(ops.len(), 2);
        assert_eq!(
            ops.first().unwrap(),
            &Operation::SetCellFormatsA1 {
                sheet_id,
                formats: SheetFormatUpdates::from_selection(&selection, FormatUpdate::cleared()),
            }
        );
        let Operation::SetBordersA1 { sheet_id, borders } = ops.last().unwrap() else {
            panic!("last operation is not SetBordersA1");
        };
        assert_eq!(sheet_id, &SheetId::TEST);
        assert!(!borders.is_empty());
    }

    fn create_test_cf(selection: &str) -> ConditionalFormat {
        use crate::a1::A1Context;
        use crate::formulas::parse_formula;

        let a1_selection = A1Selection::test_a1(selection);
        let a1_context = A1Context::default();
        let pos = a1_selection.cursor.to_sheet_pos(a1_selection.sheet_id);
        let rule = parse_formula("=TRUE", &a1_context, pos).unwrap();

        ConditionalFormat {
            id: Uuid::new_v4(),
            selection: a1_selection,
            config: ConditionalFormatConfig::Formula {
                rule,
                style: ConditionalFormatStyle {
                    fill_color: Some("#FF0000".to_string()),
                    ..Default::default()
                },
            },
            apply_to_blank: None,
        }
    }

    #[test]
    fn test_clear_format_removes_entire_conditional_format() {
        let mut gc = GridController::test();
        let sheet_id = SheetId::TEST;

        // Add a conditional format for A1:B2
        let cf = create_test_cf("A1:B2");
        let cf_id = cf.id;
        gc.grid
            .try_sheet_mut(sheet_id)
            .unwrap()
            .conditional_formats
            .set(cf, sheet_id);

        // Clear formatting for A1:B2 - should remove the entire conditional format
        let selection = A1Selection::test_a1("A1:B2");
        let ops = gc.clear_format_borders_operations(&selection, false, false);

        // Find the RemoveConditionalFormat operation
        let remove_op = ops.iter().find(|op| {
            matches!(op, Operation::RemoveConditionalFormat {
                conditional_format_id,
                ..
            } if *conditional_format_id == cf_id)
        });
        assert!(
            remove_op.is_some(),
            "Should have RemoveConditionalFormat operation"
        );
    }

    #[test]
    fn test_clear_format_updates_partial_conditional_format() {
        let mut gc = GridController::test();
        let sheet_id = SheetId::TEST;

        // Add a conditional format for A1:C3
        let cf = create_test_cf("A1:C3");
        let cf_id = cf.id;
        gc.grid
            .try_sheet_mut(sheet_id)
            .unwrap()
            .conditional_formats
            .set(cf, sheet_id);

        // Clear formatting for B2 - should update the conditional format, not remove it
        let selection = A1Selection::test_a1("B2");
        let ops = gc.clear_format_borders_operations(&selection, false, false);

        // Find the SetConditionalFormat operation
        let set_op = ops.iter().find(|op| {
            matches!(op, Operation::SetConditionalFormat {
                conditional_format,
            } if conditional_format.id == cf_id)
        });
        assert!(
            set_op.is_some(),
            "Should have SetConditionalFormat operation"
        );

        // Verify the updated selection doesn't include B2
        if let Some(Operation::SetConditionalFormat { conditional_format }) = set_op {
            let a1_context = gc.a1_context();
            assert!(
                !conditional_format
                    .selection
                    .contains_pos(crate::Pos::new(2, 2), a1_context),
                "Updated selection should not contain B2"
            );
        }
    }

    #[test]
    fn test_clear_format_no_overlap_no_cf_operations() {
        let mut gc = GridController::test();
        let sheet_id = SheetId::TEST;

        // Add a conditional format for A1:B2
        let cf = create_test_cf("A1:B2");
        gc.grid
            .try_sheet_mut(sheet_id)
            .unwrap()
            .conditional_formats
            .set(cf, sheet_id);

        // Clear formatting for D4:E5 - no overlap, should not affect conditional format
        let selection = A1Selection::test_a1("D4:E5");
        let ops = gc.clear_format_borders_operations(&selection, false, false);

        // Should not have any conditional format operations
        let cf_ops: Vec<_> = ops
            .iter()
            .filter(|op| {
                matches!(
                    op,
                    Operation::SetConditionalFormat { .. }
                        | Operation::RemoveConditionalFormat { .. }
                )
            })
            .collect();
        assert!(
            cf_ops.is_empty(),
            "Should not have any conditional format operations"
        );
    }
}
