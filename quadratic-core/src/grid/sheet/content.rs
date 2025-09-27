use crate::{
    Pos, Rect,
    a1::{A1Context, A1Selection},
    grid::Sheet,
};

impl Sheet {
    /// Returns true if the cell at Pos has content (ie, not blank). Also checks
    /// tables. Ignores Blanks except in tables.
    pub fn has_content(&self, pos: Pos) -> bool {
        if self
            .get_column(pos.x)
            .and_then(|column| column.values.get(&pos.y))
            .is_some_and(|cell_value| !cell_value.is_blank_or_empty_string())
        {
            return true;
        }
        self.has_table_content(pos, false)
    }

    pub fn has_content_in_rect(&self, rect: Rect) -> bool {
        self.columns.has_content(rect) || self.data_tables.has_content(rect)
    }

    /// Returns true if the cell at Pos has content (ie, not blank). Ignores
    /// Blanks in tables.
    pub fn has_content_ignore_blank_table(&self, pos: Pos) -> bool {
        if self
            .get_column(pos.x)
            .and_then(|column| column.values.get(&pos.y))
            .is_some_and(|cell_value| !cell_value.is_blank_or_empty_string())
        {
            return true;
        }
        self.has_table_content_ignore_blanks(pos)
    }

    /// Returns true if the selection has content (ie, not blank). Also checks
    /// tables. Ignores Blanks except in tables.
    pub fn has_content_in_selection(&self, selection: A1Selection, context: &A1Context) -> bool {
        for range in selection.ranges {
            if let Some(rect) = range.to_rect_unbounded(context) {
                if self.contains_value_within_rect(rect, None) {
                    return true;
                }
                if self.data_tables.get_in_rect(rect, true).next().is_some() {
                    return true;
                }
            }
        }
        false
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        Array, CellValue, Pos, Value,
        controller::transaction_types::{JsCellValueResult, JsCodeResult},
        grid::{CodeCellLanguage, CodeRun, DataTable, DataTableKind},
        test_util::*,
    };

    #[test]
    fn test_has_content() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let pos = pos![A1];

        // Empty cell should have no content
        assert!(!first_sheet(&gc).has_content(pos));

        // Text content
        gc.set_cell_value(pos.to_sheet_pos(sheet_id), "test".into(), None, false);
        assert!(first_sheet(&gc).has_content(pos));

        // Empty string should count as no content
        gc.set_cell_value(pos.to_sheet_pos(sheet_id), "".into(), None, false);
        assert!(!first_sheet(&gc).has_content(pos));

        // Number content
        gc.set_cell_value(pos.to_sheet_pos(sheet_id), "1".into(), None, false);
        assert!(first_sheet(&gc).has_content(pos));

        // Table content
        gc.add_data_table_from_values(
            pos.to_sheet_pos(sheet_id),
            "test".into(),
            vec![vec!["test".into(), "test".into()]],
            false,
            None,
            false,
        );
        assert!(first_sheet(&gc).has_content(pos));
        assert!(first_sheet(&gc).has_content(Pos { x: 2, y: 2 }));
        assert!(!first_sheet(&gc).has_content(Pos { x: 3, y: 2 }));

        let pos2 = Pos { x: 10, y: 10 };
        gc.set_code_cell(
            pos2.to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "print('test')".into(),
            None,
            None,
            false,
        );
        let transaction = gc.async_transactions().first().unwrap();
        gc.calculation_complete(JsCodeResult {
            transaction_id: transaction.id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("Image".to_string(), 8)),
            ..Default::default()
        })
        .ok();
        let sheet = gc.try_sheet_mut(sheet_id).unwrap();
        sheet
            .data_tables
            .modify_data_table_at(&pos2, |dt| {
                dt.header_is_first_row = false;
                dt.show_name = Some(true);
                dt.show_columns = Some(true);
                dt.chart_output = Some((5, 5));
                Ok(())
            })
            .unwrap();
        assert!(first_sheet(&gc).has_content(pos2));
        assert!(first_sheet(&gc).has_content(Pos { x: 14, y: 10 }));
        assert!(!first_sheet(&gc).has_content(Pos { x: 15, y: 10 }));
    }

    #[test]
    fn test_has_content_ignore_blank_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        let sheet = gc.sheet_mut(sheet_id);
        let pos = pos![A1];

        // Empty cell should have no content
        assert!(!sheet.has_content_ignore_blank_table(pos));

        // Text content
        sheet.set_cell_value(pos, "test");
        assert!(sheet.has_content_ignore_blank_table(pos));

        // Blank value should count as no content
        sheet.set_cell_value(pos, CellValue::Blank);
        assert!(!sheet.has_content_ignore_blank_table(pos));

        // Empty string should count as no content
        sheet.set_cell_value(pos, "");
        assert!(!sheet.has_content_ignore_blank_table(pos));

        // Table with non-blank content
        let dt = DataTable::new(
            DataTableKind::CodeRun(CodeRun::default()),
            "test",
            Value::Array(Array::from(vec![vec!["test", "test"]])),
            false,
            Some(true),
            Some(true),
            None,
        );
        sheet.data_table_insert_full(pos, dt.clone());
        assert!(sheet.has_content_ignore_blank_table(pos));
        assert!(sheet.has_content_ignore_blank_table(Pos { x: 2, y: 2 }));
        assert!(!sheet.has_content_ignore_blank_table(Pos { x: 3, y: 2 }));

        // Table with blank content should be ignored
        sheet.test_set_code_run_array(10, 10, vec!["1", "", "", "4"], false);

        let a1_context = gc.a1_context().clone();
        gc.sheet_mut(sheet_id).recalculate_bounds(&a1_context);

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.has_content_ignore_blank_table(Pos { x: 10, y: 10 }));
        assert!(!sheet.has_content_ignore_blank_table(Pos { x: 11, y: 10 }));
        assert!(sheet.has_content_ignore_blank_table(Pos { x: 13, y: 10 }));

        // Chart output should still count as content
        let dt = DataTable::new(
            DataTableKind::CodeRun(CodeRun::default()),
            "test",
            Value::Single(CellValue::Html("Html".to_string())),
            false,
            Some(true),
            Some(true),
            Some((5, 5)),
        );
        let pos3 = Pos { x: 20, y: 20 };
        let sheet = gc.sheet_mut(sheet_id);
        sheet.data_table_insert_full(pos3, dt);

        let a1_context = gc.a1_context().clone();
        gc.sheet_mut(sheet_id).recalculate_bounds(&a1_context);

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.has_content_ignore_blank_table(pos3));
        assert!(sheet.has_content_ignore_blank_table(Pos { x: 24, y: 20 }));
        assert!(!sheet.has_content_ignore_blank_table(Pos { x: 25, y: 20 }));
    }

    #[test]
    fn test_has_content_in_selection() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Test 1: Empty selection should return false
        let sheet = gc.sheet(sheet_id);
        let empty_selection = A1Selection::test_a1_sheet_id("A1:B2", sheet_id);
        assert!(!sheet.has_content_in_selection(empty_selection, gc.a1_context()));

        // Test 2: Selection with regular cell data
        gc.set_cell_value(pos![sheet_id!A1], "cell_data".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!B1], "more_data".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!C1], "even_more".to_string(), None, false);

        let sheet = gc.sheet(sheet_id);

        // Selection that includes the cell data
        let selection_with_data = A1Selection::test_a1_sheet_id("A1:C3", sheet_id);
        assert!(sheet.has_content_in_selection(selection_with_data, gc.a1_context()));

        // Selection that includes only one cell with data
        let selection_single_cell = A1Selection::test_a1_sheet_id("B1", sheet_id);
        assert!(sheet.has_content_in_selection(selection_single_cell, gc.a1_context()));

        // Selection that misses all the data
        let selection_no_data = A1Selection::test_a1_sheet_id("D4:F6", sheet_id);
        assert!(!sheet.has_content_in_selection(selection_no_data, gc.a1_context()));

        // Test 3: Create a data table and test selection with table data
        test_create_data_table(&mut gc, sheet_id, Pos { x: 5, y: 5 }, 2, 3);

        let sheet = gc.sheet(sheet_id);

        // Selection that includes the data table
        let selection_with_table = A1Selection::test_a1_sheet_id("E5:G8", sheet_id);
        assert!(sheet.has_content_in_selection(selection_with_table, gc.a1_context()));

        // Selection that partially overlaps with the data table
        let selection_partial_table = A1Selection::test_a1_sheet_id("F6:H9", sheet_id);
        assert!(sheet.has_content_in_selection(selection_partial_table, gc.a1_context()));

        // Selection that misses the data table
        let selection_miss_table = A1Selection::test_a1_sheet_id("A10:C12", sheet_id);
        assert!(!sheet.has_content_in_selection(selection_miss_table, gc.a1_context()));

        // Test 4: Selection that includes both regular cell data and table data
        let selection_mixed = A1Selection::test_a1_sheet_id("A1:G8", sheet_id);
        assert!(sheet.has_content_in_selection(selection_mixed, gc.a1_context()));

        // Test 5: Multiple ranges in selection (some with data, some without)
        let mut selection_multi_range = A1Selection::test_a1_sheet_id("A1:B2", sheet_id);
        selection_multi_range
            .ranges
            .push(A1Selection::test_a1_sheet_id("D4:E5", sheet_id).ranges[0].clone());
        selection_multi_range
            .ranges
            .push(A1Selection::test_a1_sheet_id("E5:F6", sheet_id).ranges[0].clone());

        // Should return true because at least one range contains data
        assert!(sheet.has_content_in_selection(selection_multi_range, gc.a1_context()));

        // Test 6: Multiple ranges with no data
        let mut selection_multi_empty = A1Selection::test_a1_sheet_id("J10:K11", sheet_id);
        selection_multi_empty
            .ranges
            .push(A1Selection::test_a1_sheet_id("M15:N16", sheet_id).ranges[0].clone());

        assert!(!sheet.has_content_in_selection(selection_multi_empty, gc.a1_context()));

        // Test 7: Edge case - selection with invalid ranges (should handle gracefully)
        let selection_edge_case = A1Selection {
            sheet_id,
            ranges: vec![], // Empty ranges
            cursor: pos![A1],
        };
        assert!(!sheet.has_content_in_selection(selection_edge_case, gc.a1_context()));
    }
}
