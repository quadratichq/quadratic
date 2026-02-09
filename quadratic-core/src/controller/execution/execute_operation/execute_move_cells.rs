use crate::{
    a1::A1Selection,
    controller::{
        GridController,
        active_transactions::pending_transaction::PendingTransaction,
        operations::{clipboard::PasteSpecial, operation::Operation},
    },
    grid::sheet::merge_cells::MergeCellsUpdate,
    ClearOption, Pos, Rect,
};

impl GridController {
    pub fn execute_move_cells(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::MoveCells {
            source,
            dest,
            columns,
            rows,
        } = op
        {
            let selection = if columns {
                A1Selection::cols(source.sheet_id, source.min.x, source.max.x)
            } else if rows {
                A1Selection::rows(source.sheet_id, source.min.y, source.max.y)
            } else {
                A1Selection::from_rect(source)
            };

            let source_rect = Rect::new(source.min.x, source.min.y, source.max.x, source.max.y);
            let dest_rect = Rect::new(
                dest.x,
                dest.y,
                dest.x + (source.max.x - source.min.x),
                dest.y + (source.max.y - source.min.y),
            );

            let (source_merges, existing_merges_at_dest) = if !columns && !rows {
                let sheet = self.try_sheet(source.sheet_id);
                let source = sheet
                    .map(|sheet| sheet.merge_cells.get_merge_cells(source_rect))
                    .unwrap_or_default();
                let existing = sheet
                    .map(|sheet| sheet.merge_cells.get_merge_cells(dest_rect))
                    .unwrap_or_default();
                (source, existing)
            } else {
                (vec![], vec![])
            };

            if let Ok((clipboard, mut ops)) = self.cut_to_clipboard_operations(&selection, false) {
                let sheet_id = source.sheet_id;
                let has_clipboard_merges = clipboard
                    .merge_rects
                    .as_ref()
                    .is_some_and(|v| !v.is_empty());

                match self.paste_html_operations(
                    dest.into(),
                    dest.into(),
                    &A1Selection::from_single_cell(dest),
                    clipboard,
                    PasteSpecial::None,
                ) {
                    Ok((paste_ops, data_table_ops)) => {
                        ops.extend(paste_ops);
                        ops.extend(data_table_ops);
                    }
                    Err(_) => return,
                }

                if !source_merges.is_empty() || has_clipboard_merges {
                    transaction.merge_cells_updates.entry(sheet_id).or_default();
                }

                if !source_merges.is_empty() {
                    let dx = dest.x - source_rect.min.x;
                    let dy = dest.y - source_rect.min.y;

                    for merge_rect in &source_merges {
                        let mut unmerge_source = MergeCellsUpdate::default();
                        unmerge_source.set_rect(
                            merge_rect.min.x,
                            merge_rect.min.y,
                            Some(merge_rect.max.x),
                            Some(merge_rect.max.y),
                            Some(ClearOption::Clear),
                        );
                        ops.push(Operation::SetMergeCells {
                            sheet_id,
                            merge_cells_updates: unmerge_source,
                        });
                    }

                    for existing_rect in &existing_merges_at_dest {
                        let mut unmerge = MergeCellsUpdate::default();
                        unmerge.set_rect(
                            existing_rect.min.x,
                            existing_rect.min.y,
                            Some(existing_rect.max.x),
                            Some(existing_rect.max.y),
                            Some(ClearOption::Clear),
                        );
                        ops.push(Operation::SetMergeCells {
                            sheet_id,
                            merge_cells_updates: unmerge,
                        });
                    }

                    for merge_rect in &source_merges {
                        let dest_merge_min = Pos {
                            x: merge_rect.min.x + dx,
                            y: merge_rect.min.y + dy,
                        };
                        let dest_merge_max = Pos {
                            x: merge_rect.max.x + dx,
                            y: merge_rect.max.y + dy,
                        };
                        let mut merge_dest = MergeCellsUpdate::default();
                        merge_dest.set_rect(
                            dest_merge_min.x,
                            dest_merge_min.y,
                            Some(dest_merge_max.x),
                            Some(dest_merge_max.y),
                            Some(ClearOption::Some(dest_merge_min)),
                        );
                        ops.push(Operation::SetMergeCells {
                            sheet_id,
                            merge_cells_updates: merge_dest,
                        });
                    }
                }

                transaction.operations.extend(ops);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::VecDeque;

    use crate::test_util::*;
    use crate::{
        a1::A1Selection,
        Rect, SheetPos,
        controller::{
            active_transactions::pending_transaction::PendingTransaction,
            active_transactions::transaction_name::TransactionName,
            execution::TransactionSource,
            user_actions::import::tests::{simple_csv, simple_csv_at},
        },
    };

    use super::*;

    #[test]
    fn test_move_cells() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();

        let dest_pos = pos![F1];
        let sheet_dest_pos = SheetPos::from((dest_pos, sheet_id));
        let ops = vec![Operation::MoveCells {
            source: data_table.output_sheet_rect(sheet_pos, true),
            dest: sheet_dest_pos,
            columns: false,
            rows: false,
        }];
        gc.start_user_ai_transaction(ops, None, TransactionName::MoveCells, false);
        print_table_in_rect(&gc, sheet_id, Rect::new(6, 1, 10, 12));
    }

    #[test]
    fn test_move_data_table_within_its_current_output_rect() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv_at(pos![E2]);
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();

        assert_import(&gc, sheet_pos, file_name, 4, 12);

        let dest_pos = pos![F4];
        let sheet_dest_pos = SheetPos::from((dest_pos, sheet_id));

        gc.move_cols_rows(
            data_table.output_sheet_rect(sheet_pos, true),
            sheet_dest_pos,
            false,
            false,
            None,
            false,
        );

        assert_eq!(gc.sheet(sheet_id).cell_value(pos), None);
        assert!(gc.sheet(sheet_id).data_table_at(&pos).is_none());

        assert_import(&gc, sheet_dest_pos, file_name, 4, 12);
    }

    #[test]
    fn test_move_rich_text_cell() {
        use crate::CellValue;
        use crate::cellvalue::TextSpan;

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a RichText cell with bold and italic spans at A1
        let spans = vec![
            TextSpan {
                text: "Bold ".to_string(),
                bold: Some(true),
                ..Default::default()
            },
            TextSpan {
                text: "Italic ".to_string(),
                italic: Some(true),
                ..Default::default()
            },
            TextSpan::plain("Normal"),
        ];
        let source_pos = pos![A1];
        let sheet_source_pos = SheetPos::from((source_pos, sheet_id));
        gc.set_cell_rich_text(sheet_source_pos, spans.clone(), None);

        // Verify the RichText cell is at A1
        let cell_value = gc.sheet(sheet_id).cell_value(source_pos);
        assert!(
            matches!(cell_value, Some(CellValue::RichText(_))),
            "Expected RichText at source position before move, got {:?}",
            cell_value
        );

        // Move the cell from A1 to C3
        let dest_pos = pos![C3];
        let sheet_dest_pos = SheetPos::from((dest_pos, sheet_id));
        gc.move_cols_rows(
            crate::SheetRect::single_sheet_pos(sheet_source_pos),
            sheet_dest_pos,
            false,
            false,
            None,
            false,
        );

        // Verify the source cell (A1) is now empty
        let source_value = gc.sheet(sheet_id).cell_value(source_pos);
        assert!(
            source_value.is_none(),
            "Source cell should be empty after move, got {:?}",
            source_value
        );

        // Verify the destination cell (C3) has the RichText
        let dest_value = gc.sheet(sheet_id).cell_value(dest_pos);
        let Some(CellValue::RichText(moved_spans)) = dest_value else {
            panic!(
                "Destination cell should have RichText after move, got {:?}",
                dest_value
            );
        };

        // Verify the spans are preserved
        assert_eq!(moved_spans.len(), 3);
        assert_eq!(moved_spans[0].text, "Bold ");
        assert_eq!(moved_spans[0].bold, Some(true));
        assert_eq!(moved_spans[1].text, "Italic ");
        assert_eq!(moved_spans[1].italic, Some(true));
        assert_eq!(moved_spans[2].text, "Normal");
    }

    #[test]
    fn test_move_selection_with_multiple_merged_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(pos![sheet_id!A1], "a".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!A2], "b".to_string(), None, false);
        gc.merge_cells(A1Selection::test_a1_sheet_id("A1:B1", sheet_id), None, false);
        gc.merge_cells(A1Selection::test_a1_sheet_id("A2:B2", sheet_id), None, false);

        let source_rect = Rect::new(1, 1, 2, 2);
        let source = crate::SheetRect::new(1, 1, 2, 2, sheet_id);
        let dest = pos![sheet_id!D1];

        gc.move_cells(source, dest, false, false, None, false);

        let sheet = gc.sheet(sheet_id);
        let source_merges = sheet.merge_cells.get_merge_cells(source_rect);
        assert!(source_merges.is_empty(), "Source should be unmerged after move");

        let dest_rect = Rect::new(4, 1, 5, 2);
        let dest_merges = sheet.merge_cells.get_merge_cells(dest_rect);
        assert_eq!(dest_merges.len(), 2, "Destination should have two merged cells");
        assert_eq!(sheet.cell_value(pos![D1]), Some(crate::CellValue::Text("a".to_string())));
        assert_eq!(sheet.cell_value(pos![D2]), Some(crate::CellValue::Text("b".to_string())));
    }

    #[test]
    fn test_move_merged_cell_overlapping_clears_old_formats() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Merge B13:D19 and give it a blue fill
        gc.merge_cells(
            A1Selection::test_a1_sheet_id("B13:D19", sheet_id),
            None,
            false,
        );
        let _ = gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("B13:D19", sheet_id),
            Some("blue".to_string()),
            None,
            false,
        );

        // Verify fill is set
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.fill_color.get(pos![D18]), Some("blue".to_string()));

        // Move the merged cell to A10 (overlapping: dest A10:C16 overlaps source B13:D19)
        let source = crate::SheetRect::new(2, 13, 4, 19, sheet_id);
        let dest = pos![sheet_id!A10];
        gc.move_cells(source, dest, false, false, None, false);

        let sheet = gc.sheet(sheet_id);

        // The destination A10:C16 should have the blue fill
        assert_eq!(
            sheet.formats.fill_color.get(pos![A10]),
            Some("blue".to_string()),
            "A10 (dest anchor) should have blue fill"
        );

        // D18 is in the source (B13:D19) but NOT in the dest (A10:C16).
        // Its fill must be cleared.
        assert_eq!(
            sheet.formats.fill_color.get(pos![D18]),
            None,
            "D18 should have no fill after move (it's outside the destination range)"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![D15]),
            None,
            "D15 should have no fill after move (column D is outside dest)"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![B18]),
            None,
            "B18 should have no fill after move (row 18 is outside dest)"
        );
    }

    #[test]
    fn test_move_with_merged_cell_sets_merge_cells_updates() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(pos![sheet_id!A1], "a".to_string(), None, false);
        gc.merge_cells(A1Selection::test_a1_sheet_id("A1:B1", sheet_id), None, false);

        let source = crate::SheetRect::new(1, 1, 2, 1, sheet_id);
        let dest = pos![sheet_id!D1];
        let ops = gc.move_cells_operations(source, dest, false, false);

        let mut transaction = PendingTransaction {
            transaction_name: TransactionName::MoveCells,
            source: TransactionSource::User,
            operations: ops.into_iter().collect::<VecDeque<_>>(),
            ..Default::default()
        };

        gc.start_transaction(&mut transaction);

        assert!(
            transaction.merge_cells_updates.contains_key(&sheet_id),
            "Moving a selection that includes a merged cell should set merge_cells_updates so the client refreshes"
        );
    }
}
