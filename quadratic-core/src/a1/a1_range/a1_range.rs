use crate::{A1Range, A1RangeType};

impl A1Range {
    /// Returns true if the A1Part is excluded.
    pub fn is_excluded(&self) -> bool {
        matches!(
            self.range,
            A1RangeType::ExcludeColumn(_)
                | A1RangeType::ExcludeRow(_)
                | A1RangeType::ExcludeColumnRange(_)
                | A1RangeType::ExcludeRowRange(_)
                | A1RangeType::ExcludeRect(_)
                | A1RangeType::ExcludePos(_)
        )
    }

    /// Gets the general cell count of the A1Part. Returns None for all
    /// sheet-based ranges (eg, *, A, 1:5). ExcludedRanges return 0.
    pub fn cell_count(&self) -> Option<usize> {
        match &self.range {
            A1RangeType::All => None,
            A1RangeType::Column(_) => None,
            A1RangeType::Row(_) => None,
            A1RangeType::ColumnRange(_) => None,
            A1RangeType::RowRange(_) => None,
            A1RangeType::Rect(rect) => Some(rect.count()),
            A1RangeType::Pos(_) => Some(1),
            A1RangeType::ExcludeColumn(_) => Some(0),
            A1RangeType::ExcludeRow(_) => Some(0),
            A1RangeType::ExcludeColumnRange(_) => Some(0),
            A1RangeType::ExcludeRowRange(_) => Some(0),
            A1RangeType::ExcludeRect(_) => Some(0),
            A1RangeType::ExcludePos(_) => Some(0),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::{grid::SheetId, A1Range};

    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_is_excluded() {
        let sheet_id = SheetId::new();
        let sheet_id_2 = SheetId::new();
        let sheet_name_id = HashMap::from([
            ("Sheet 1".to_string(), sheet_id),
            ("Sheet 2".to_string(), sheet_id_2),
        ]);

        // Test non-excluded A1Parts
        let non_excluded = vec![
            A1Range::from_a1("A", sheet_id, &sheet_name_id).unwrap(),
            A1Range::from_a1("1", sheet_id, &sheet_name_id).unwrap(),
            A1Range::from_a1("A:C", sheet_id, &sheet_name_id).unwrap(),
            A1Range::from_a1("1:3", sheet_id, &sheet_name_id).unwrap(),
            A1Range::from_a1("A1", sheet_id, &sheet_name_id).unwrap(),
            A1Range::from_a1("A1:B2", sheet_id, &sheet_name_id).unwrap(),
        ];

        for range in non_excluded {
            assert!(
                !range.is_excluded(),
                "Expected {:?} to not be excluded",
                range
            );
        }

        // Test excluded A1Parts
        let mut excluded = vec![
            A1Range::from_a1("A", sheet_id, &sheet_name_id).unwrap(),
            A1Range::from_a1("1", sheet_id, &sheet_name_id).unwrap(),
            A1Range::from_a1("A:C", sheet_id, &sheet_name_id).unwrap(),
            A1Range::from_a1("1:3", sheet_id, &sheet_name_id).unwrap(),
            A1Range::from_a1("A1", sheet_id, &sheet_name_id).unwrap(),
            A1Range::from_a1("A1:B2", sheet_id, &sheet_name_id).unwrap(),
        ];

        for range in &mut excluded {
            range.to_excluded().unwrap();
            assert!(range.is_excluded(), "Expected {:?} to be excluded", range);
        }

        // Test that All cannot be excluded
        let mut all = A1Range::from_a1("*", sheet_id, &sheet_name_id).unwrap();
        assert!(
            all.to_excluded().is_err(),
            "Expected All to not be excluded"
        );
    }
}
