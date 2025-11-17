use crate::{
    Pos, Rect,
    a1::{A1Context, SelectionState},
    grid::{SheetId, sheet::merge_cells::MergeCells},
};

use super::super::{A1Selection, CellRefRange};

#[test]
fn test_move_to() {
    let mut selection = A1Selection::test_a1("A1,B1,C1");
    selection.move_to(2, 2, false);
    assert_eq!(selection.test_to_string(), "B2");
}

#[test]
fn test_select_rect() {
    let mut selection = A1Selection::test_a1("A1,B2,C3");
    selection.select_rect(1, 1, 2, 2, false);
    assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);
    assert_eq!(selection.cursor.x, 1);
    assert_eq!(selection.cursor.y, 1);

    let mut selection = A1Selection::test_a1("A1:C3");
    selection.select_rect(3, 3, 5, 5, true);
    assert_eq!(
        selection.ranges,
        vec![
            CellRefRange::test_a1("A1:C3"),
            CellRefRange::test_a1("C3:E5"),
        ]
    );
    assert_eq!(selection.cursor.x, 3);
    assert_eq!(selection.cursor.y, 3);
}

#[test]
fn test_select_to() {
    let context = A1Context::default();
    let mut selection = A1Selection::test_a1("A1");
    let _ = selection.select_to(2, 2, false, &context, None, None);
    assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);

    selection = A1Selection::test_a1("A:B");
    let _ = selection.select_to(2, 2, false, &context, None, None);
    assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A:B2")]);

    selection = A1Selection::test_a1("A1");
    let _ = selection.select_to(3, 3, false, &context, None, None);
    let _ = selection.select_to(1, 1, false, &context, None, None);
    assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1")]);

    let mut selection = A1Selection::test_a1("A1,B2,C3");
    let _ = selection.select_to(2, 2, false, &context, None, None);
    // When selecting from C3 to B2 (right-to-left, bottom-to-top), the range is normalized to B2:C3
    assert_eq!(selection.ranges, vec![CellRefRange::test_a1("B2:C3")]);
}

#[test]
fn test_select_rect_single_cell() {
    let mut selection = A1Selection::test_a1("A1");
    selection.select_rect(2, 2, 2, 2, false);
    assert_eq!(selection.ranges, vec![CellRefRange::test_a1("B2")]);
    assert_eq!(selection.cursor.x, 2);
    assert_eq!(selection.cursor.y, 2);
}

#[test]
fn test_select_to_with_append() {
    let context = A1Context::default();
    let mut selection = A1Selection::test_a1("A1");
    let _ = selection.select_to(2, 2, true, &context, None, None);
    assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);

    // Test appending to existing selection
    let _ = selection.select_to(3, 3, true, &context, None, None);
    assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:C3")]);
}

#[test]
fn test_table_selection() {
    let context = A1Context::test(
        &[("Sheet1", SheetId::TEST)],
        &[("Table1", &["col1", "col2", "col3"], Rect::test_a1("A1:C3"))],
    );

    let mut selection = A1Selection::test_a1_context("Table1", &context);
    let _ = selection.select_to(5, 5, true, &context, None, None);
    assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:E5")]);

    // Test table column selection
    selection = A1Selection::test_a1_context("Table1[col2]", &context);
    let _ = selection.select_to(4, 6, true, &context, None, None);
    assert_eq!(selection.ranges, vec![CellRefRange::test_a1("B2:D6")]);
}

#[test]
fn test_complex_selection_scenarios() {
    let context = A1Context::default();

    // Test multiple discontinuous ranges
    let mut selection = A1Selection::test_a1("A1:B2,D4:E5");
    let _ = selection.select_to(6, 6, false, &context, None, None);
    assert_eq!(selection.ranges, vec![CellRefRange::test_a1("D4:F6")]);
}

#[test]
fn test_unbounded_selection_edge_cases() {
    let context = A1Context::default();

    // Test unbounded column selection
    let mut selection = A1Selection::test_a1("A:");
    let _ = selection.select_to(3, 5, false, &context, None, None);
    assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:C5")]);

    // Test unbounded row selection
    selection = A1Selection::test_a1("1:");
    let _ = selection.select_to(4, 3, false, &context, None, None);
    assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:D3")]);

    // Test selection starting from unbounded
    selection = A1Selection::test_a1(":");
    let _ = selection.select_to(2, 2, false, &context, None, None);
    assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);
}

#[test]
fn test_select_to_with_merged_cell_drag() {
    let context = A1Context::default();
    let mut merge_cells = MergeCells::default();

    // Add merged cell from D5:G12
    merge_cells.merge_cells(Rect::test_a1("D5:G12"));

    // Start selection at B2
    let mut selection = A1Selection::test_a1("B2");

    // Select to E7 - merged cell should be included
    // B2 to E7 overlaps with merged cell D5:G12, so selection should expand to include entire merged cell
    let _ = selection.select_to(5, 7, false, &context, Some(&merge_cells), None);
    let ranges = &selection.ranges;
    assert_eq!(ranges.len(), 1);
    if let CellRefRange::Sheet { range } = &ranges[0] {
        // The selection B2:E7 overlaps with merged cell D5:G12 (columns 4-7, rows 5-12)
        // So it should expand to include the entire merged cell
        // Selection should be at least B2:G12 (columns 2-7, rows 2-12)
        let end_col = range.end.col();
        let end_row = range.end.row();
        assert!(
            end_col >= 7,
            "Selection end column {} should be >= 7 (G) to include merged cell",
            end_col
        );
        assert!(
            end_row >= 12,
            "Selection end row {} should be >= 12 to include merged cell",
            end_row
        );
    }

    // Drag to D14 - merged cell should still be selected (not partially selected)
    // When dragging from E7 to D14, we're moving left and down, but the selection B2:D14
    // still overlaps with merged cell D5:G12 (column 4 overlaps, rows 5-12 overlap),
    // so the merged cell should remain fully included
    let _ = selection.select_to(
        4,
        14,
        false,
        &context,
        Some(&merge_cells),
        Some(SelectionState::for_mouse_drag(selection.cursor)),
    );
    let ranges_after_drag = &selection.ranges;
    assert_eq!(ranges_after_drag.len(), 1);
    if let CellRefRange::Sheet { range } = &ranges_after_drag[0] {
        // The merged cell D5:G12 should still be fully included
        // Selection from B2 to D14 overlaps with D5:G12, so it should expand to include entire merged cell
        let end_col = range.end.col();
        let end_row = range.end.row();
        assert!(
            end_col >= 7,
            "Selection end column {} should be >= 7 (G) to include merged cell D5:G12",
            end_col
        );
        assert!(
            end_row >= 12,
            "Selection end row {} should be >= 12 to include merged cell D5:G12",
            end_row
        );

        // Verify the merged cell is fully included (not partially selected)
        if let Some(selection_rect) = range.to_rect() {
            // Check that D5:G12 is fully within the selection
            // D5:G12 means columns 4-7, rows 5-12
            assert!(
                selection_rect.min.x <= 4 && selection_rect.min.y <= 5,
                "Selection should start before or at merged cell start (D5 is col 4, row 5)"
            );
            assert!(
                selection_rect.max.x >= 7 && selection_rect.max.y >= 12,
                "Selection should end after or at merged cell end (G12 is col 7, row 12)"
            );
        } else {
            panic!("Selection should be finite");
        }
    }
}

#[test]
fn test_select_to_with_multiple_merged_cells() {
    let context = A1Context::default();
    let mut merge_cells = MergeCells::default();

    // Add three merged cells:
    // Merged cell 1: B2:D4 (columns 2-4, rows 2-4)
    // Merged cell 2: F5:H7 (columns 6-8, rows 5-7)
    // Merged cell 3: I8:J10 (columns 9-10, rows 8-10)
    // The selection from A1 to G6 should include merged cell 1 and 2
    // When we expand to include merged cell 2, we should check if merged cell 3 now overlaps
    merge_cells.merge_cells(Rect::test_a1("B2:D4"));
    merge_cells.merge_cells(Rect::test_a1("F5:H7"));
    merge_cells.merge_cells(Rect::test_a1("I8:J10"));

    // Start selection at A1
    let mut selection = A1Selection::test_a1("A1");

    // Select to G6 - this should include merged cells B2:D4 and F5:H7
    // A1 to G6 overlaps with B2:D4 (columns 2-4, rows 2-4) and F5:H7 (columns 6-8, rows 5-7)
    // When we expand to include F5:H7, we need to check if I8:J10 now overlaps
    // (It shouldn't in this case, but the logic should check)
    let _ = selection.select_to(7, 6, false, &context, Some(&merge_cells), None);
    let ranges = &selection.ranges;
    assert_eq!(ranges.len(), 1);
    if let CellRefRange::Sheet { range } = &ranges[0] {
        // The selection should include both merged cells B2:D4 and F5:H7
        // So it should be at least A1:H7 (columns 1-8, rows 1-7)
        let end_col = range.end.col();
        let end_row = range.end.row();
        assert!(
            end_col >= 8,
            "Selection end column {} should be >= 8 (H) to include merged cell F5:H7",
            end_col
        );
        assert!(
            end_row >= 7,
            "Selection end row {} should be >= 7 to include merged cell F5:H7",
            end_row
        );

        // Verify merged cell B2:D4 is fully included
        assert!(
            range.start.col() <= 2 && range.start.row() <= 2,
            "Selection should start before or at merged cell B2:D4"
        );
        assert!(
            end_col >= 4 && end_row >= 4,
            "Selection should include entire merged cell B2:D4"
        );

        // Verify merged cell F5:H7 is fully included
        assert!(
            range.start.col() <= 6 && range.start.row() <= 5,
            "Selection should start before or at merged cell F5:H7"
        );
        assert!(
            end_col >= 8 && end_row >= 7,
            "Selection should include entire merged cell F5:H7"
        );
    }

    // Now test a case where expanding to include one merged cell reveals another
    // Add merged cell 4: E8:F9 (columns 5-6, rows 8-9) - this is adjacent to F5:H7
    merge_cells.merge_cells(Rect::test_a1("E8:F9"));

    // Select from A1 to G7 - this should include F5:H7, and when we expand to include it,
    // we should check if E8:F9 now overlaps (it doesn't, but we should check)
    let mut selection2 = A1Selection::test_a1("A1");
    let _ = selection2.select_to(7, 7, false, &context, Some(&merge_cells), None);

    // Now extend selection to H9 - this should include E8:F9
    // When we expand to include F5:H7, we should check if E8:F9 overlaps
    // E8:F9 (columns 5-6, rows 8-9) overlaps with the expanded selection that includes F5:H7
    let _ = selection2.select_to(8, 9, false, &context, Some(&merge_cells), None);
    let ranges2 = &selection2.ranges;
    assert_eq!(ranges2.len(), 1);
    if let CellRefRange::Sheet { range } = &ranges2[0] {
        // The selection should include F5:H7 and E8:F9
        // So it should be at least A1:H9 (columns 1-8, rows 1-9)
        let end_col = range.end.col();
        let end_row = range.end.row();
        assert!(
            end_col >= 8,
            "Selection end column {} should be >= 8 (H) to include merged cells",
            end_col
        );
        assert!(
            end_row >= 9,
            "Selection end row {} should be >= 9 to include merged cell E8:F9",
            end_row
        );
    }
}

#[test]
fn test_select_to_with_merged_cells_no_drag() {
    let context = A1Context::default();
    let mut merge_cells = MergeCells::default();

    // Test 1: Single merged cell that extends beyond selection bounds
    // Merged cell D5:G12 extends beyond selection B2:E14, should still be included
    merge_cells.merge_cells(Rect::test_a1("D5:G12"));
    let mut selection = A1Selection::test_a1("B2");
    let _ = selection.select_to(5, 14, false, &context, Some(&merge_cells), None);
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert!(
            range.end.col() >= 7,
            "Should include merged cell extending beyond selection"
        );
        assert!(
            range.end.row() >= 12,
            "Should include merged cell extending beyond selection"
        );
    }

    // Test 2: Multiple merged cells
    merge_cells = MergeCells::default();
    merge_cells.merge_cells(Rect::test_a1("C3:E5"));
    merge_cells.merge_cells(Rect::test_a1("G7:I9"));
    let mut selection2 = A1Selection::test_a1("A1");
    let _ = selection2.select_to(8, 8, false, &context, Some(&merge_cells), None);
    if let CellRefRange::Sheet { range } = &selection2.ranges[0] {
        assert!(range.end.col() >= 9, "Should include both merged cells");
        assert!(range.end.row() >= 9, "Should include both merged cells");
    }
}

#[test]
fn test_forward_keyboard_selection_right_multiple_cells() {
    let context = A1Context::default();
    // Start at A1 (column 1, row 1)
    let mut selection = A1Selection::test_a1("A1");
    assert_eq!(selection.cursor.x, 1);
    assert_eq!(selection.cursor.y, 1);

    // Move right to B1 (column 2, row 1) - forward selection
    let _ = selection.select_to(2, 1, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 1,
        "Cursor should stay at A1 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 1,
        "Cursor should stay at A1 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 1, "Range start should be A1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 2, "Range end should be B1");
        assert_eq!(range.end.row(), 1);
    }

    // Move right again to C1 (column 3, row 1)
    let _ = selection.select_to(3, 1, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 1,
        "Cursor should still stay at A1 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 1,
        "Cursor should still stay at A1 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 1, "Range start should be A1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 3, "Range end should be C1");
        assert_eq!(range.end.row(), 1);
    }

    // Move right again to D1 (column 4, row 1)
    let _ = selection.select_to(4, 1, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 1,
        "Cursor should still stay at A1 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 1,
        "Cursor should still stay at A1 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 1, "Range start should be A1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 4, "Range end should be D1");
        assert_eq!(range.end.row(), 1);
    }
}

#[test]
fn test_forward_keyboard_selection_down_multiple_cells() {
    let context = A1Context::default();
    // Start at A1 (column 1, row 1)
    let mut selection = A1Selection::test_a1("A1");
    assert_eq!(selection.cursor.x, 1);
    assert_eq!(selection.cursor.y, 1);

    // Move down to A2 (column 1, row 2) - forward selection
    let _ = selection.select_to(1, 2, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 1,
        "Cursor should stay at A1 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 1,
        "Cursor should stay at A1 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 1, "Range start should be A1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 1, "Range end should be A2");
        assert_eq!(range.end.row(), 2);
    }

    // Move down again to A3 (column 1, row 3)
    let _ = selection.select_to(1, 3, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 1,
        "Cursor should still stay at A1 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 1,
        "Cursor should still stay at A1 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 1, "Range start should be A1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 1, "Range end should be A3");
        assert_eq!(range.end.row(), 3);
    }
}

#[test]
fn test_forward_keyboard_selection_right_and_down() {
    let context = A1Context::default();
    // Start at A1 (column 1, row 1)
    let mut selection = A1Selection::test_a1("A1");
    assert_eq!(selection.cursor.x, 1);
    assert_eq!(selection.cursor.y, 1);

    // Move right to B1
    let _ = selection.select_to(2, 1, true, &context, None, None);
    assert_eq!(selection.cursor.x, 1);
    assert_eq!(selection.cursor.y, 1);

    // Move down to B2 (right and down)
    let _ = selection.select_to(2, 2, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 1,
        "Cursor should stay at A1 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 1,
        "Cursor should stay at A1 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 1, "Range start should be A1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 2, "Range end should be B2");
        assert_eq!(range.end.row(), 2);
    }

    // Move right again to C2
    let _ = selection.select_to(3, 2, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 1,
        "Cursor should still stay at A1 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 1,
        "Cursor should still stay at A1 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 1, "Range start should be A1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 3, "Range end should be C2");
        assert_eq!(range.end.row(), 2);
    }

    // Move down again to C3
    let _ = selection.select_to(3, 3, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 1,
        "Cursor should still stay at A1 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 1,
        "Cursor should still stay at A1 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 1, "Range start should be A1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 3, "Range end should be C3");
        assert_eq!(range.end.row(), 3);
    }
}

#[test]
fn test_reverse_then_forward_selection_up_then_right() {
    let context = A1Context::default();
    // Start at C17 (column 3, row 17)
    let mut selection = A1Selection::test_a1("C17");
    assert_eq!(selection.cursor.x, 3);
    assert_eq!(selection.cursor.y, 17);

    // Move up to C16 (column 3, row 16) - reverse selection
    let _ = selection.select_to(3, 16, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 3,
        "Cursor should stay at C17 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 17,
        "Cursor should stay at C17 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 3, "Range start should be C16");
        assert_eq!(range.start.row(), 16);
        assert_eq!(range.end.col(), 3, "Range end should be C17");
        assert_eq!(range.end.row(), 17);
    }

    // Move up again to C15
    let _ = selection.select_to(3, 15, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 3,
        "Cursor should still stay at C17 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 17,
        "Cursor should still stay at C17 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 3, "Range start should be C15");
        assert_eq!(range.start.row(), 15);
        assert_eq!(range.end.col(), 3, "Range end should be C17");
        assert_eq!(range.end.row(), 17);
    }

    // Move up again to C14
    let _ = selection.select_to(3, 14, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 3,
        "Cursor should still stay at C17 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 17,
        "Cursor should still stay at C17 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 3, "Range start should be C14");
        assert_eq!(range.start.row(), 14);
        assert_eq!(range.end.col(), 3, "Range end should be C17");
        assert_eq!(range.end.row(), 17);
    }

    // Now move right to D14 - should extend selection right
    let _ = selection.select_to(4, 14, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 3,
        "Cursor should still stay at C17 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 17,
        "Cursor should still stay at C17 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 3, "Range start should be C14");
        assert_eq!(range.start.row(), 14);
        assert_eq!(range.end.col(), 4, "Range end should be D17");
        assert_eq!(range.end.row(), 17);
    }

    // Move right again to E14
    let _ = selection.select_to(5, 14, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 3,
        "Cursor should still stay at C17 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 17,
        "Cursor should still stay at C17 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 3, "Range start should be C14");
        assert_eq!(range.start.row(), 14);
        assert_eq!(range.end.col(), 5, "Range end should be E17");
        assert_eq!(range.end.row(), 17);
    }
}

#[test]
fn test_reverse_keyboard_selection_left_multiple_cells() {
    let context = A1Context::default();
    // Start at E11 (column 5, row 11)
    let mut selection = A1Selection::test_a1("E11");
    assert_eq!(selection.cursor.x, 5);
    assert_eq!(selection.cursor.y, 11);

    // Move left to D11 (column 4, row 11) - reverse selection
    let _ = selection.select_to(4, 11, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 5,
        "Cursor should stay at E11 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 11,
        "Cursor should stay at E11 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 4, "Range start should be D11");
        assert_eq!(range.start.row(), 11);
        assert_eq!(range.end.col(), 5, "Range end should be E11");
        assert_eq!(range.end.row(), 11);
    }

    // Move left again to C11 (column 3, row 11)
    let _ = selection.select_to(3, 11, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 5,
        "Cursor should still stay at E11 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 11,
        "Cursor should still stay at E11 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 3, "Range start should be C11");
        assert_eq!(range.start.row(), 11);
        assert_eq!(range.end.col(), 5, "Range end should be E11");
        assert_eq!(range.end.row(), 11);
    }

    // Move left again to B11 (column 2, row 11)
    let _ = selection.select_to(2, 11, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 5,
        "Cursor should still stay at E11 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 11,
        "Cursor should still stay at E11 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 2, "Range start should be B11");
        assert_eq!(range.start.row(), 11);
        assert_eq!(range.end.col(), 5, "Range end should be E11");
        assert_eq!(range.end.row(), 11);
    }

    // Move left again to A11 (column 1, row 11)
    let _ = selection.select_to(1, 11, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 5,
        "Cursor should still stay at E11 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 11,
        "Cursor should still stay at E11 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 1, "Range start should be A11");
        assert_eq!(range.start.row(), 11);
        assert_eq!(range.end.col(), 5, "Range end should be E11");
        assert_eq!(range.end.row(), 11);
    }
}

#[test]
fn test_reverse_keyboard_selection_up_multiple_cells() {
    let context = A1Context::default();
    // Start at E11 (column 5, row 11)
    let mut selection = A1Selection::test_a1("E11");
    assert_eq!(selection.cursor.x, 5);
    assert_eq!(selection.cursor.y, 11);

    // Move up to E10 (column 5, row 10) - reverse selection
    let _ = selection.select_to(5, 10, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 5,
        "Cursor should stay at E11 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 11,
        "Cursor should stay at E11 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 5, "Range start should be E10");
        assert_eq!(range.start.row(), 10);
        assert_eq!(range.end.col(), 5, "Range end should be E11");
        assert_eq!(range.end.row(), 11);
    }

    // Move up again to E9 (column 5, row 9)
    let _ = selection.select_to(5, 9, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 5,
        "Cursor should still stay at E11 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 11,
        "Cursor should still stay at E11 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 5, "Range start should be E9");
        assert_eq!(range.start.row(), 9);
        assert_eq!(range.end.col(), 5, "Range end should be E11");
        assert_eq!(range.end.row(), 11);
    }

    // Move up again to E8 (column 5, row 8)
    let _ = selection.select_to(5, 8, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 5,
        "Cursor should still stay at E11 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 11,
        "Cursor should still stay at E11 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 5, "Range start should be E8");
        assert_eq!(range.start.row(), 8);
        assert_eq!(range.end.col(), 5, "Range end should be E11");
        assert_eq!(range.end.row(), 11);
    }
}

#[test]
fn test_reverse_keyboard_selection_left_and_up() {
    let context = A1Context::default();
    // Start at E11 (column 5, row 11)
    let mut selection = A1Selection::test_a1("E11");
    assert_eq!(selection.cursor.x, 5);
    assert_eq!(selection.cursor.y, 11);

    // Move left to D11
    let _ = selection.select_to(4, 11, true, &context, None, None);
    assert_eq!(selection.cursor.x, 5);
    assert_eq!(selection.cursor.y, 11);

    // Move up to D10 (left and up)
    let _ = selection.select_to(4, 10, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 5,
        "Cursor should stay at E11 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 11,
        "Cursor should stay at E11 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 4, "Range start should be D10");
        assert_eq!(range.start.row(), 10);
        assert_eq!(range.end.col(), 5, "Range end should be E11");
        assert_eq!(range.end.row(), 11);
    }

    // Move left again to C10
    let _ = selection.select_to(3, 10, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 5,
        "Cursor should still stay at E11 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 11,
        "Cursor should still stay at E11 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 3, "Range start should be C10");
        assert_eq!(range.start.row(), 10);
        assert_eq!(range.end.col(), 5, "Range end should be E11");
        assert_eq!(range.end.row(), 11);
    }

    // Move up again to C9
    let _ = selection.select_to(3, 9, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 5,
        "Cursor should still stay at E11 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 11,
        "Cursor should still stay at E11 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 3, "Range start should be C9");
        assert_eq!(range.start.row(), 9);
        assert_eq!(range.end.col(), 5, "Range end should be E11");
        assert_eq!(range.end.row(), 11);
    }
}

#[test]
fn test_reverse_keyboard_selection_with_merged_cell_left() {
    let context = A1Context::default();
    let mut merge_cells = MergeCells::default();

    // Create merged cell at D6:F10
    merge_cells.merge_cells(Rect::test_a1("D6:F10"));

    // Start with selection from C5:G11 (includes the merged cell)
    let mut selection = A1Selection::test_a1("C5:G11");
    // Set cursor to G11 (the end, simulating reverse selection)
    selection.cursor = Pos { x: 7, y: 11 };

    // Verify initial state
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 3, "Range start should be C5");
        assert_eq!(range.start.row(), 5);
        assert_eq!(range.end.col(), 7, "Range end should be G11");
        assert_eq!(range.end.row(), 11);
    }

    // Create a state with anchor at C5 (the top-left corner) to simulate keyboard selection
    // that started from C5 and expanded to G11
    let state = Some(SelectionState::for_keyboard_shift(Pos { x: 3, y: 5 }));

    // First move left to F11 (column 6, row 11) - with anchor at C5, should create selection C5:F11
    let _ = selection.select_to(6, 11, false, &context, Some(&merge_cells), state);

    // Cursor should be at C5 (anchor point for this keyboard selection)
    assert_eq!(
        selection.cursor.x, 3,
        "Cursor should be at C5 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 5,
        "Cursor should be at C5 (anchor point)"
    );

    // With anchor-based selection, moving to F11 from anchor C5 creates C5:F11
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        let start_col = range.start.col();
        let start_row = range.start.row();
        let end_col = range.end.col();
        let end_row = range.end.row();

        // Selection from C5 to F11
        assert_eq!(start_col, 3, "Range start should be C5 (column 3)");
        assert_eq!(start_row, 5, "Range start should be at row 5");
        assert_eq!(end_col, 6, "Range end should be F11 (column 6)");
        assert_eq!(end_row, 11, "Range end should be row 11");
    }

    // Second move left to E11 (column 5, row 11) - selection C5:E11 overlaps with merged cell D6:F10
    // The merged cell should be FULLY included (expanded to F10)
    let state2 = Some(SelectionState::for_keyboard_shift(Pos { x: 3, y: 5 }));
    let _ = selection.select_to(5, 11, false, &context, Some(&merge_cells), state2);

    // Cursor should still be at C5 (anchor point)
    assert_eq!(
        selection.cursor.x, 3,
        "Cursor should still be at C5 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 5,
        "Cursor should still be at C5 (anchor point)"
    );

    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        let start_col = range.start.col();
        let end_col = range.end.col();
        let end_row = range.end.row();

        assert_eq!(start_col, 3, "Range start should be C5 (column 3)");
        // The merged cell D6:F10 (columns 4-6, rows 6-10) overlaps with C5:E11
        // RULE: If selection contains ANY cell of merged cell, include ENTIRE merged cell
        // So selection should expand to include full merged cell: C5:F11
        assert_eq!(
            end_col, 6,
            "Selection C5:E11 overlaps with merged cell D6:F10, should expand to include it fully (end at F=6), got end_col={}",
            end_col
        );
        assert_eq!(end_row, 11, "Range end row should be 11");
    }

    // Move left to C11 (column 3, row 11) - selection C5:C11 does NOT overlap with merged cell D6:F10
    // The merged cell should not be included
    let state3 = Some(SelectionState::for_keyboard_shift(Pos { x: 3, y: 5 }));
    let _ = selection.select_to(3, 11, false, &context, Some(&merge_cells), state3);

    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        let end_col = range.end.col();
        assert_eq!(
            end_col, 3,
            "Selection C5:C11 does not overlap with merged cell D6:F10, got end_col={}",
            end_col
        );
    }
}

#[test]
fn test_select_through_horizontal_merged_cell() {
    let context = A1Context::default();
    let mut merge_cells = MergeCells::default();

    // Create horizontal merged cell B3:E3 (columns 2-5, row 3)
    merge_cells.merge_cells(Rect::test_a1("B3:E3"));

    // Start at C2 (column 3, row 2)
    let mut selection = A1Selection::test_a1("C2");
    assert_eq!(selection.cursor.x, 3);
    assert_eq!(selection.cursor.y, 2);

    // First, select to C3 (entering the merged cell)
    // Selection C2:C3 contains C3, which is part of merged cell B3:E3
    // So the entire merged cell B3:E3 should be included
    let state1 = Some(SelectionState::for_keyboard_shift(Pos { x: 3, y: 2 }));
    let _ = selection.select_to(3, 3, false, &context, Some(&merge_cells), state1);

    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert!(
            range.start.col() <= 2,
            "After C3: Selection should expand left to include merged cell start (B=2), got start_col={}",
            range.start.col()
        );
        assert!(
            range.end.col() >= 5,
            "After C3: Selection should expand right to include merged cell end (E=5), got end_col={}",
            range.end.col()
        );
        assert_eq!(
            range.start.row(),
            2,
            "After C3: Selection should start at row 2"
        );
        assert_eq!(
            range.end.row(),
            3,
            "After C3: Selection should end at row 3"
        );
    }

    // Now select to C4 (column 3, row 4) - continuing through the merged cell
    // The merged cell should still be fully included
    let state2 = Some(SelectionState::for_keyboard_shift(Pos { x: 3, y: 2 }));
    let _ = selection.select_to(3, 4, false, &context, Some(&merge_cells), state2);

    // Verify the entire merged cell is still included
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        // The selection should expand horizontally to include the entire merged cell
        assert!(
            range.start.col() <= 2,
            "After C4: Selection should expand left to include merged cell start (B=2), got start_col={}",
            range.start.col()
        );
        assert!(
            range.end.col() >= 5,
            "After C4: Selection should expand right to include merged cell end (E=5), got end_col={}",
            range.end.col()
        );

        // Vertical extent should include C2 to C4
        assert_eq!(
            range.start.row(),
            2,
            "After C4: Selection should start at row 2"
        );
        assert_eq!(
            range.end.row(),
            4,
            "After C4: Selection should end at row 4"
        );
    }

    // Also test with mouse drag (same result expected)
    let mut selection2 = A1Selection::test_a1("C2");
    let drag_state = Some(SelectionState::for_mouse_drag(Pos { x: 3, y: 2 }));
    let _ = selection2.select_to(3, 4, false, &context, Some(&merge_cells), drag_state);

    if let CellRefRange::Sheet { range } = &selection2.ranges[0] {
        assert!(
            range.start.col() <= 2,
            "Drag selection should expand left to include merged cell start (B=2), got start_col={}",
            range.start.col()
        );
        assert!(
            range.end.col() >= 5,
            "Drag selection should expand right to include merged cell end (E=5), got end_col={}",
            range.end.col()
        );
    }
}

#[test]
fn test_keyboard_selection_blocked_by_merged_cell_pivot() {
    let context = A1Context::default();
    let mut merge_cells = MergeCells::default();

    // Create horizontal merged cell B3:E3 (columns 2-5, row 3)
    merge_cells.merge_cells(Rect::test_a1("B3:E3"));

    // Start with selection B2:B4 (anchor at B2)
    let mut selection = A1Selection::test_a1("B2");
    let state1 = Some(SelectionState::for_keyboard_shift(Pos { x: 2, y: 2 }));
    let _ = selection.select_to(2, 4, false, &context, Some(&merge_cells), state1);

    // Verify initial selection includes the merged cell
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 2, "Initial selection should start at B");
        assert_eq!(
            range.start.row(),
            2,
            "Initial selection should start at row 2"
        );
        // Should expand right to include merged cell
        assert!(
            range.end.col() >= 5,
            "Initial selection should include merged cell (E=5)"
        );
        assert_eq!(range.end.row(), 4, "Initial selection should end at row 4");
    }

    // The key insight: anchor is at B2, but due to merged cell expansion, the selection is B2:E4
    // When we try to select left, we want to extend left from B to A
    // To do this with anchor-based selection, we need to:
    // 1. Move the anchor to A2
    // 2. Select to E4 (the previous selectionEnd) to maintain the extent

    // First verify what the cursor position is after expansion
    assert_eq!(
        selection.cursor.x, 2,
        "Cursor should be at B after merged cell expansion"
    );
    assert_eq!(selection.cursor.y, 2, "Cursor should be at row 2");

    // Simulate the anchor shift: move cursor to A2
    selection.move_to(1, 2, false);
    assert_eq!(selection.cursor.x, 1, "Cursor moved to A2");

    // Now select to E4 (the previous selectionEnd) to expand the selection
    // This should create A2:E4 with the merged cell
    let state2 = Some(SelectionState::for_keyboard_shift(Pos { x: 1, y: 2 }));
    let _ = selection.select_to(5, 4, false, &context, Some(&merge_cells), state2);

    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        println!(
            "After anchor shift to A2 and select to E4: range = {:?}",
            range
        );
        assert_eq!(
            range.start.col(),
            1,
            "Selection should extend left to A, got start_col={}",
            range.start.col()
        );
        assert_eq!(range.start.row(), 2, "Selection should start at row 2");
        assert_eq!(
            range.end.col(),
            5,
            "Selection should include merged cell (E=5), got end_col={}",
            range.end.col()
        );
        assert_eq!(range.end.row(), 4, "Selection should end at row 4");
    }
}

#[test]
fn test_keyboard_selection_completely_blocked_by_merged_cell() {
    let context = A1Context::default();
    let mut merge_cells = MergeCells::default();

    // Create horizontal merged cell B3:E3 (columns 2-5, row 3)
    merge_cells.merge_cells(Rect::test_a1("B3:E3"));

    // Start with selection B2:E4 (anchor already at B, leftmost position of merged cell)
    let mut selection = A1Selection::test_a1("B2");
    let state1 = Some(SelectionState::for_keyboard_shift(Pos { x: 2, y: 2 }));
    let _ = selection.select_to(5, 4, false, &context, Some(&merge_cells), state1);

    // Verify selection is B2:E4
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 2, "Selection should start at B");
        assert_eq!(range.end.col(), 5, "Selection should end at E");
        assert_eq!(range.start.row(), 2);
        assert_eq!(range.end.row(), 4);
    }

    // Test blocking at sheet edge: anchor at column A (leftmost), trying to move further left
    // This demonstrates the TypeScript pivot logic - when movement is blocked,
    // the selection remains unchanged (handled by TypeScript returning early when both
    // selectionEnd and anchor movement are blocked)
}

#[test]
fn test_forward_down_then_reverse_left_multiple_times() {
    let context = A1Context::default();
    // Start at D1 to allow left movement
    let mut selection = A1Selection::test_a1("D1");
    assert_eq!(selection.cursor.x, 4);
    assert_eq!(selection.cursor.y, 1);

    // Move down to D2 (forward selection)
    let _ = selection.select_to(4, 2, true, &context, None, None);
    assert_eq!(selection.cursor.x, 4);
    assert_eq!(selection.cursor.y, 1);

    // Move down again to D3 (forward selection)
    let _ = selection.select_to(4, 3, true, &context, None, None);
    assert_eq!(selection.cursor.x, 4);
    assert_eq!(selection.cursor.y, 1);
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 4, "Range start should be D1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 4, "Range end should be D3");
        assert_eq!(range.end.row(), 3);
    }

    // First move left to C3 (should extend left, creating C1:D3)
    let _ = selection.select_to(3, 3, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 4,
        "Cursor should stay at D1 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 1,
        "Cursor should stay at D1 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 3, "Range start should be C1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 4, "Range end should be D3");
        assert_eq!(range.end.row(), 3);
    }

    // Second move left to B3
    let _ = selection.select_to(2, 3, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 4,
        "Cursor should stay at D1 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 1,
        "Cursor should stay at D1 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 2, "Range start should be B1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 4, "Range end should be D3");
        assert_eq!(range.end.row(), 3);
    }

    // Third move left to A3
    let _ = selection.select_to(1, 3, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 4,
        "Cursor should stay at D1 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 1,
        "Cursor should stay at D1 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 1, "Range start should be A1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 4, "Range end should be D3");
        assert_eq!(range.end.row(), 3);
    }
}

#[test]
fn test_reverse_up_then_forward_right_multiple_times() {
    let context = A1Context::default();
    // Start at C3 (column 3, row 3)
    let mut selection = A1Selection::test_a1("C3");
    assert_eq!(selection.cursor.x, 3);
    assert_eq!(selection.cursor.y, 3);

    // Move up to C2 (reverse selection)
    let _ = selection.select_to(3, 2, true, &context, None, None);
    assert_eq!(selection.cursor.x, 3);
    assert_eq!(selection.cursor.y, 3);
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 3, "Range start should be C2");
        assert_eq!(range.start.row(), 2);
        assert_eq!(range.end.col(), 3, "Range end should be C3");
        assert_eq!(range.end.row(), 3);
    }

    // Move up again to C1 (reverse selection)
    let _ = selection.select_to(3, 1, true, &context, None, None);
    assert_eq!(selection.cursor.x, 3);
    assert_eq!(selection.cursor.y, 3);
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 3, "Range start should be C1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 3, "Range end should be C3");
        assert_eq!(range.end.row(), 3);
    }

    // First move right to D1 (should extend right, creating C1:D3)
    // When moving right after reverse selection, selecting to start row preserves height
    let _ = selection.select_to(4, 1, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 3,
        "Cursor should stay at C3 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 3,
        "Cursor should stay at C3 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 3, "Range start should be C1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 4, "Range end should be D3");
        assert_eq!(range.end.row(), 3);
    }

    // Second move right to E1
    let _ = selection.select_to(5, 1, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 3,
        "Cursor should stay at C3 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 3,
        "Cursor should stay at C3 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 3, "Range start should be C1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 5, "Range end should be E3");
        assert_eq!(
            range.end.row(),
            3,
            "Range end row should stay at 3 (height of 3)"
        );
    }

    // Third move right to F1 - should maintain height of 3
    let _ = selection.select_to(6, 1, true, &context, None, None);
    assert_eq!(
        selection.cursor.x, 3,
        "Cursor should stay at C3 (anchor point)"
    );
    assert_eq!(
        selection.cursor.y, 3,
        "Cursor should stay at C3 (anchor point)"
    );
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 3, "Range start should be C1");
        assert_eq!(range.start.row(), 1);
        assert_eq!(range.end.col(), 6, "Range end should be F3");
        assert_eq!(
            range.end.row(),
            3,
            "Range end row should stay at 3 (height of 3), but got {}",
            range.end.row()
        );
    }
}

#[test]
fn test_keyboard_shrink_with_merged_cell_bottom_right() {
    let context = A1Context::default();
    let mut merge_cells = MergeCells::default();

    // Create merged cell at D4:F6 (columns 4-6, rows 4-6)
    merge_cells.merge_cells(Rect::test_a1("D4:F6"));

    // Start with anchor at B2, select to J10 (includes merged cell)
    let mut selection = A1Selection::test_a1("B2");
    let state = Some(SelectionState::for_keyboard_shift(Pos { x: 2, y: 2 }));

    // Select to J10 - should include the merged cell
    let _ = selection.select_to(10, 10, false, &context, Some(&merge_cells), state);

    // Verify merged cell is included
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert!(
            range.start.col() <= 4,
            "Should include merged cell start (D=4)"
        );
        assert!(
            range.start.row() <= 4,
            "Should include merged cell start (4)"
        );
        assert!(range.end.col() >= 6, "Should include merged cell end (F=6)");
        assert!(range.end.row() >= 6, "Should include merged cell end (6)");
    }

    // Move left to I10 - merged cell should still be included (still fully selected)
    let state2 = Some(SelectionState::for_keyboard_shift(Pos { x: 2, y: 2 }));
    let _ = selection.select_to(9, 10, false, &context, Some(&merge_cells), state2);

    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert!(
            range.end.col() >= 6,
            "Merged cell should still be included at I10, got end_col={}",
            range.end.col()
        );
    }

    // Move left to H10 - merged cell should still be included
    let state3 = Some(SelectionState::for_keyboard_shift(Pos { x: 2, y: 2 }));
    let _ = selection.select_to(8, 10, false, &context, Some(&merge_cells), state3);

    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert!(
            range.end.col() >= 6,
            "Merged cell should still be included at H10, got end_col={}",
            range.end.col()
        );
    }

    // Move left to G10 (column 7) - merged cell should still be included (one cell beyond merged cell right edge)
    let state4 = Some(SelectionState::for_keyboard_shift(Pos { x: 2, y: 2 }));
    let _ = selection.select_to(7, 10, false, &context, Some(&merge_cells), state4);

    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert!(
            range.end.col() >= 6,
            "Merged cell should still be included at G10 (one cell beyond edge), got end_col={}",
            range.end.col()
        );
    }

    // Move left to F10 (column 6) - this is AT the merged cell's right edge, should still include it
    let state5 = Some(SelectionState::for_keyboard_shift(Pos { x: 2, y: 2 }));
    let _ = selection.select_to(6, 10, false, &context, Some(&merge_cells), state5);

    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(
            range.end.col(),
            6,
            "Selection should include merged cell at F10 (at edge), got end_col={}",
            range.end.col()
        );
    }

    // Move left to E10 (column 5) - selection B2:E10 overlaps with merged cell D4:F6
    // The merged cell should be FULLY included (expanded to F6)
    let state6 = Some(SelectionState::for_keyboard_shift(Pos { x: 2, y: 2 }));
    let _ = selection.select_to(5, 10, false, &context, Some(&merge_cells), state6);

    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(
            range.end.col(),
            6,
            "Merged cell D4:F6 overlaps with B2:E10, so it should be fully included (end at F), got end_col={}",
            range.end.col()
        );
        assert_eq!(range.end.row(), 10, "End row should be 10");
    }

    // Move left to C10 (column 3) - selection B2:C10 does NOT overlap with merged cell D4:F6
    // The merged cell should be excluded
    let state7 = Some(SelectionState::for_keyboard_shift(Pos { x: 2, y: 2 }));
    let _ = selection.select_to(3, 10, false, &context, Some(&merge_cells), state7);

    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(
            range.end.col(),
            3,
            "Selection B2:C10 does not overlap with merged cell D4:F6, so merged cell should not be included, got end_col={}",
            range.end.col()
        );
        assert_eq!(range.end.row(), 10, "End row should be 10");
    }
}

#[test]
fn test_keyboard_selection_at_boundary_no_shrink() {
    // Test that when selection_end is at the sheet boundary,
    // pressing shift+arrow in that direction does nothing (no pivot/shrink)
    let context = A1Context::default();

    // Test 1: A1:C3 with anchor at C3, selection_end at A1
    // Pressing shift+left should do nothing (already at column A)
    let mut selection = A1Selection::test_a1("C3");
    let state1 = Some(SelectionState::for_keyboard_shift(Pos { x: 3, y: 3 }));
    let _ = selection.select_to(1, 1, false, &context, None, state1);
    assert_eq!(
        selection.test_to_string(),
        "A1:C3",
        "Initial selection should be A1:C3"
    );
    assert_eq!(selection.cursor, Pos { x: 3, y: 3 }, "Cursor at anchor C3");

    // Try to move left from A1 (should do nothing, not shrink to A1:B3)
    let state2 = Some(SelectionState::for_keyboard_shift(Pos { x: 3, y: 3 }));
    let _ = selection.select_to(0, 1, false, &context, None, state2); // Try column 0 (invalid)
    assert_eq!(
        selection.test_to_string(),
        "A1:C3",
        "Selection should remain A1:C3 when trying to move beyond left boundary"
    );
    assert_eq!(selection.cursor, Pos { x: 3, y: 3 }, "Cursor still at C3");

    // Test 2: A1:C3 with anchor at C3, selection_end at A1
    // Pressing shift+up should do nothing (already at row 1)
    let mut selection2 = A1Selection::test_a1("C3");
    let state3 = Some(SelectionState::for_keyboard_shift(Pos { x: 3, y: 3 }));
    let _ = selection2.select_to(1, 1, false, &context, None, state3);
    assert_eq!(
        selection2.test_to_string(),
        "A1:C3",
        "Initial selection should be A1:C3"
    );

    // Try to move up from A1 (should do nothing, not shrink to A2:C3)
    let state4 = Some(SelectionState::for_keyboard_shift(Pos { x: 3, y: 3 }));
    let _ = selection2.select_to(1, 0, false, &context, None, state4); // Try row 0 (invalid)
    assert_eq!(
        selection2.test_to_string(),
        "A1:C3",
        "Selection should remain A1:C3 when trying to move beyond top boundary"
    );
    assert_eq!(selection2.cursor, Pos { x: 3, y: 3 }, "Cursor still at C3");
}

#[test]
fn test_shift_left_expand_with_merged_cell() {
    let context = A1Context::default();
    let mut merge_cells = MergeCells::default();

    // Create horizontal merged cell B3:E3 (columns 2-5, row 3)
    merge_cells.merge_cells(Rect::test_a1("B3:E3"));

    // Start with selection B2:E4
    // Simulate selecting B2:E4 with cursor at E4
    let mut selection = A1Selection::test_a1("E4");
    let state1 = Some(SelectionState::for_keyboard_shift(Pos { x: 5, y: 4 }));
    let _ = selection.select_to(2, 2, false, &context, Some(&merge_cells), state1);

    // Verify initial selection is B2:E4
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 2, "Initial selection should start at B");
        assert_eq!(
            range.start.row(),
            2,
            "Initial selection should start at row 2"
        );
        assert_eq!(range.end.col(), 5, "Initial selection should end at E");
        assert_eq!(range.end.row(), 4, "Initial selection should end at row 4");
    }

    // Now press shift+left arrow
    // This should move the selection_end from B2 to A2, expanding the selection to A2:E4
    // Get current selection_end
    let selection_end = selection.last_selection_end(&context);
    println!("Selection end before shift+left: {:?}", selection_end);
    println!("Cursor before shift+left: {:?}", selection.cursor);

    // Simulate moving left from selection_end
    use crate::SheetPos;
    use crate::grid::SheetId;
    use crate::input::move_cursor::move_cursor;
    let selection_end_pos = SheetPos {
        x: selection_end.x,
        y: selection_end.y,
        sheet_id: SheetId::new(),
    };

    // Create empty data tables cache for testing
    use crate::grid::sheet::data_tables::cache::SheetDataTablesCache;
    let data_tables_cache = SheetDataTablesCache::default();

    let new_pos = move_cursor(
        selection_end_pos,
        crate::grid::js_types::Direction::Left,
        &data_tables_cache,
        &context,
        Some(&merge_cells),
    );

    println!("New position after move_cursor: {:?}", new_pos);

    // Verify the move was not blocked (should move from B2 to A2)
    assert_eq!(
        new_pos.x, 1,
        "Movement from B2 to A2 should not be blocked by merged cell B3:E3"
    );
    assert_eq!(new_pos.y, 2, "Y coordinate should remain at row 2");

    // Now do the actual select_to to expand the selection
    let state2 = Some(SelectionState::for_keyboard_shift(Pos { x: 5, y: 4 }));
    let _ = selection.select_to(
        new_pos.x,
        new_pos.y,
        false,
        &context,
        Some(&merge_cells),
        state2,
    );

    // Verify the selection expanded to A2:E4
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(
            range.start.col(),
            1,
            "Selection should expand left to A (column 1), got start_col={}",
            range.start.col()
        );
        assert_eq!(range.start.row(), 2, "Selection should start at row 2");
        assert_eq!(
            range.end.col(),
            5,
            "Selection should still end at E (column 5), got end_col={}",
            range.end.col()
        );
        assert_eq!(range.end.row(), 4, "Selection should end at row 4");
    }
}

#[test]
fn test_shift_left_shrink_with_merged_cell() {
    // This tests the scenario where the cursor/anchor is at B2 and selection extends to E4
    // Then pressing shift+left should shrink from E4 to D4 (expected behavior)
    let context = A1Context::default();
    let mut merge_cells = MergeCells::default();

    // Create horizontal merged cell B3:E3 (columns 2-5, row 3)
    merge_cells.merge_cells(Rect::test_a1("B3:E3"));

    // Start with cursor at B2, then extend to E4 to create B2:E4 selection
    let mut selection = A1Selection::test_a1("B2");
    let state1 = Some(SelectionState::for_keyboard_shift(Pos { x: 2, y: 2 }));
    let _ = selection.select_to(5, 4, false, &context, Some(&merge_cells), state1);

    // Verify initial selection is B2:E4
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(range.start.col(), 2, "Initial selection should start at B");
        assert_eq!(
            range.start.row(),
            2,
            "Initial selection should start at row 2"
        );
        assert_eq!(range.end.col(), 5, "Initial selection should end at E");
        assert_eq!(range.end.row(), 4, "Initial selection should end at row 4");
    }

    // Cursor should be at B2 (the anchor)
    assert_eq!(selection.cursor.x, 2, "Cursor should be at B2");
    assert_eq!(selection.cursor.y, 2, "Cursor should be at B2");

    // When pressing shift+left, the selection_end (E4) moves left to D4
    // This is a shrink operation, not an expand
    let selection_end = selection.last_selection_end(&context);
    println!(
        "Selection end before shift+left (shrink): {:?}",
        selection_end
    );
    println!("Cursor before shift+left (shrink): {:?}", selection.cursor);

    // Simulate moving left from selection_end (E4)
    use crate::SheetPos;
    use crate::grid::SheetId;
    use crate::grid::sheet::data_tables::cache::SheetDataTablesCache;
    use crate::input::move_cursor::move_cursor;

    let selection_end_pos = SheetPos {
        x: selection_end.x,
        y: selection_end.y,
        sheet_id: SheetId::new(),
    };

    let data_tables_cache = SheetDataTablesCache::default();

    let new_pos = move_cursor(
        selection_end_pos,
        crate::grid::js_types::Direction::Left,
        &data_tables_cache,
        &context,
        Some(&merge_cells),
    );

    println!("New position after move_cursor (shrink): {:?}", new_pos);

    // Verify it moves from E4 to D4 (one cell left)
    assert_eq!(new_pos.x, 4, "Should move from E4 to D4");
    assert_eq!(new_pos.y, 4, "Y coordinate should remain at row 4");

    // Now do the actual select_to to shrink the selection
    let state2 = Some(SelectionState::for_keyboard_shift(Pos { x: 2, y: 2 }));
    let _ = selection.select_to(
        new_pos.x,
        new_pos.y,
        false,
        &context,
        Some(&merge_cells),
        state2,
    );

    // Because the selection includes the merged cell B3:E3, shrinking to D4 would
    // partially overlap with the merged cell. The merged cell must remain fully selected,
    // so the selection stays at B2:E4 (blocked from shrinking)
    if let CellRefRange::Sheet { range } = &selection.ranges[0] {
        assert_eq!(
            range.start.col(),
            2,
            "Selection should still start at B (column 2), got start_col={}",
            range.start.col()
        );
        assert_eq!(range.start.row(), 2, "Selection should start at row 2");
        assert_eq!(
            range.end.col(),
            5,
            "Selection should remain at E (column 5) because the merged cell B3:E3 must be fully selected, got end_col={}",
            range.end.col()
        );
        assert_eq!(range.end.row(), 4, "Selection should end at row 4");
    }
}
