// todo: not sure what if anything to do with this file. maybe delete?

//! These functions return Vec<(Pos, &CellValue)> for a Selection in the Sheet.
//! 1. if selection includes all, then all cells are returned
//! 2. otherwise, the selection iterates over columns, rows, and then rects

use crate::{
    grid::{formats::Format, GridBounds},
    selection::OldSelection,
    Pos, Rect,
};

use super::Sheet;

impl Sheet {
    /// Gets a list of cells with formatting for a selection. Only cells with a
    /// format are returned.
    /// TODO: return &Format when we change how formats are stored internally.
    pub fn format_selection(&self, _selection: &OldSelection) -> Vec<(Pos, Format)> {
        todo!("probably remove this; otherwise update it")
        // let mut cells = HashMap::new();
        // if selection.all {
        //     if let GridBounds::NonEmpty(bounds) = self.format_bounds {
        //         for x in bounds.min.x..=bounds.max.x {
        //             if let Some(column) = self.columns.get(&x) {
        //                 for y in bounds.min.y..=bounds.max.y {
        //                     if let Some(format) = column.format(y) {
        //                         cells.insert(Pos { x, y }, format);
        //                     }
        //                 }
        //             }
        //         }
        //     }
        // }

        // if let Some(columns) = selection.columns.as_ref() {
        //     columns.iter().for_each(|x| {
        //         if let Some(column) = self.get_column(*x) {
        //             if let Some(range) = column.format_range() {
        //                 for y in range.start..=range.end {
        //                     if let Some(format) = column.format(y) {
        //                         cells.insert(Pos { x: *x, y }, format);
        //                     }
        //                 }
        //             }
        //         }
        //     });
        // }

        // if let Some(rows) = selection.rows.as_ref() {
        //     self.columns.iter().for_each(|(x, column)| {
        //         if let Some(range) = column.format_range() {
        //             rows.iter().for_each(|y| {
        //                 if range.contains(y) {
        //                     if let Some(format) = column.format(*y) {
        //                         cells.insert(Pos { x: *x, y: *y }, format);
        //                     }
        //                 }
        //             });
        //         }
        //     });
        // }

        // if let Some(rects) = selection.rects.as_ref() {
        //     for rect in rects {
        //         for x in rect.min.x..=rect.max.x {
        //             if let Some(column) = self.columns.get(&x) {
        //                 for y in rect.min.y..=rect.max.y {
        //                     if let Some(format) = column.format(y) {
        //                         cells.insert(Pos { x, y }, format);
        //                     }
        //                 }
        //             }
        //         }
        //     }
        // }
        // cells.into_iter().collect()
    }

    /// **Deprecated** Nov 2024 in favor of [`Self::selection_to_rects()`].
    ///
    /// Returns a vec of Rects for a selection. This is useful for creating
    /// Operation::SetCellValues so we don't overlap areas that are not
    /// selected.
    ///
    /// todo: this returns CodeRuns bounds as well. We probably should make the
    /// CodeRuns optional as they're not needed for things like
    /// delete_cell_operations operations. But it doesn't do any harm.
    pub fn selection_rects_values(&self, selection: &OldSelection) -> Vec<Rect> {
        let mut rects = vec![];
        if selection.all {
            if let GridBounds::NonEmpty(bounds) = self.bounds(false) {
                rects.push(bounds);
            }
        }

        if let Some(columns) = selection.columns.as_ref() {
            for x in columns.iter() {
                if let Some((min, max)) = self.column_bounds(*x, false) {
                    rects.push(Rect::new(*x, min, *x, max));
                }
            }
        }

        if let Some(rows) = selection.rows.as_ref() {
            for y in rows.iter() {
                if let Some((min, max)) = self.row_bounds(*y, false) {
                    rects.push(Rect::new(min, *y, max, *y));
                }
            }
        }

        if let Some(rects_selection) = selection.rects.as_ref() {
            rects.extend(rects_selection.iter().cloned());
        }
        rects
    }
}

// #[cfg(test)]
// mod tests {
//     use super::*;
//     use crate::{
//         grid::{formats::format_update::FormatUpdate, CodeCellLanguage},
//         CodeCellValue, Rect,
//     };
//     use bigdecimal::BigDecimal;
//     use serial_test::parallel;
//     use std::str::FromStr;

//     /// Used to test whether the results of a selection has a position and value.
//     fn assert_results_has_value(results: &IndexMap<Pos, &CellValue>, pos: Pos, value: CellValue) {
//         assert!(results.iter().any(|(p, v)| *p == pos && **v == value));
//     }

//     #[test]
//     #[parallel]
//     fn selection_all() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_values(
//             0,
//             0,
//             3,
//             3,
//             vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
//         );
//         sheet.test_set_code_run_array(-1, -10, vec!["1", "2", "3"], true);

//         let selection = OldSelection {
//             sheet_id: sheet.id,
//             x: 0,
//             y: 0,
//             rects: None,
//             rows: None,
//             columns: None,
//             all: true,
//         };

//         let results = sheet.selection(&selection, None, false, false).unwrap();
//         assert_eq!(results.len(), 12);

//         let results = sheet.selection(&selection, Some(10), false, false);
//         assert!(results.is_none());

//         let results = sheet.selection(&selection, None, true, false).unwrap();
//         assert_eq!(results.len(), 10);
//     }

//     #[test]
//     #[parallel]
//     fn selection_columns() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_values(
//             0,
//             0,
//             3,
//             3,
//             vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
//         );
//         sheet.test_set_code_run_single(
//             0,
//             5,
//             CellValue::Number(BigDecimal::from_str("11").unwrap()),
//         );
//         sheet.test_set_code_run_array(-1, 0, vec!["10", "11", "12"], true);

//         assert_eq!(
//             sheet.display_value(Pos { x: -1, y: -0 }),
//             Some(CellValue::Number(BigDecimal::from_str("10.0").unwrap()))
//         );

//         let selection = OldSelection {
//             sheet_id: sheet.id,
//             x: 0,
//             y: 0,
//             rects: None,
//             rows: None,
//             columns: Some(vec![0, 1, -1]),
//             all: false,
//         };

//         let results = sheet.selection(&selection, None, false, false).unwrap();
//         assert_eq!(results.len(), 10);
//         assert_results_has_value(&results, Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
//         assert_results_has_value(&results, Pos { x: -1, y: 2 }, CellValue::Number(12.into()));

//         let results = sheet.selection(&selection, Some(5), false, false);
//         assert!(results.is_none());

//         let results = sheet.selection(&selection, None, true, false).unwrap();
//         assert_eq!(results.len(), 8);
//     }

//     #[test]
//     #[parallel]
//     fn selection_rows() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_values(
//             0,
//             0,
//             3,
//             3,
//             vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
//         );
//         sheet.test_set_code_run_array(-1, -10, vec!["1", "2", "3"], false);

//         let selection = OldSelection {
//             sheet_id: sheet.id,
//             x: 0,
//             y: 0,
//             rects: None,
//             rows: Some(vec![0, 1, -10]),
//             columns: None,
//             all: false,
//         };

//         let results = sheet.selection(&selection, None, false, false).unwrap();
//         assert_eq!(results.len(), 9);

//         let results = sheet.selection(&selection, Some(5), false, false);
//         assert!(results.is_none());

//         let results = sheet.selection(&selection, None, true, false).unwrap();
//         assert_eq!(results.len(), 7);
//     }

//     #[test]
//     #[parallel]
//     fn selection_rects_values() {
//         let mut sheet = Sheet::test();
//         // create a 3x3 array at 0,0
//         sheet.test_set_values(
//             0,
//             0,
//             3,
//             3,
//             vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
//         );
//         let rects = vec![
//             Rect::from_numbers(0, 0, 1, 1),
//             Rect::from_numbers(1, 1, 2, 2),
//         ];
//         let results = sheet
//             .selection(
//                 &OldSelection {
//                     sheet_id: sheet.id,
//                     x: 0,
//                     y: 0,
//                     rects: Some(rects.clone()),
//                     rows: None,
//                     columns: None,
//                     all: false,
//                 },
//                 None,
//                 false,
//                 false,
//             )
//             .unwrap();
//         assert_eq!(results.len(), 5);
//         assert_results_has_value(&results, Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
//         assert_results_has_value(&results, Pos { x: 1, y: 1 }, CellValue::Number(5.into()));
//         assert_results_has_value(&results, Pos { x: 1, y: 2 }, CellValue::Number(8.into()));
//         assert_results_has_value(&results, Pos { x: 2, y: 1 }, CellValue::Number(6.into()));
//         assert_results_has_value(&results, Pos { x: 2, y: 2 }, CellValue::Number(9.into()));

//         assert!(sheet
//             .selection(
//                 &OldSelection {
//                     sheet_id: sheet.id,
//                     x: 0,
//                     y: 0,
//                     rects: Some(rects),
//                     rows: None,
//                     columns: None,
//                     all: false,
//                 },
//                 Some(3),
//                 false,
//                 false,
//             )
//             .is_none());
//     }

//     #[test]
//     #[parallel]
//     fn selection_rects_code() {
//         let mut sheet = Sheet::test();

//         // create a 1x3 array at 4,0
//         sheet.test_set_code_run_array(4, 0, vec!["1", "2", "3"], true);

//         let rects = vec![
//             Rect::from_numbers(4, 0, 1, 1),
//             Rect::from_numbers(4, 2, 1, 2),
//         ];
//         let results = sheet
//             .selection(
//                 &OldSelection {
//                     sheet_id: sheet.id,
//                     x: 0,
//                     y: 0,
//                     rects: Some(rects.clone()),
//                     rows: None,
//                     columns: None,
//                     all: false,
//                 },
//                 None,
//                 false,
//                 false,
//             )
//             .unwrap();
//         assert_results_has_value(&results, (4, 0).into(), CellValue::Number(1.into()));
//         assert_results_has_value(&results, (4, 2).into(), CellValue::Number(3.into()));

//         assert!(sheet
//             .selection(
//                 &OldSelection {
//                     sheet_id: sheet.id,
//                     x: 0,
//                     y: 0,
//                     rects: Some(rects.clone()),
//                     rows: None,
//                     columns: None,
//                     all: false,
//                 },
//                 Some(1),
//                 false,
//                 false
//             )
//             .is_none());

//         let results = sheet
//             .selection(
//                 &OldSelection {
//                     sheet_id: sheet.id,
//                     x: 0,
//                     y: 0,
//                     rects: Some(rects),
//                     rows: None,
//                     columns: None,
//                     all: false,
//                 },
//                 None,
//                 true,
//                 false,
//             )
//             .unwrap();
//         assert_eq!(results.len(), 1);
//         assert_eq!(
//             results.get(&Pos { x: 4, y: 0 }).unwrap(),
//             &&CellValue::Code(CodeCellValue {
//                 language: CodeCellLanguage::Formula,
//                 code: "code".to_string()
//             })
//         );
//     }

//     #[test]
//     #[parallel]
//     fn selection() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_values(
//             0,
//             0,
//             3,
//             3,
//             vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
//         );
//         sheet.test_set_code_run_array(0, 4, vec!["1", "2", "3"], false);

//         let selection = OldSelection {
//             sheet_id: sheet.id,
//             x: 0,
//             y: 0,
//             rects: Some(vec![Rect::single_pos(Pos { x: 0, y: 0 })]),
//             rows: Some(vec![4]),
//             columns: Some(vec![2]),
//             all: false,
//         };

//         let results = sheet.selection(&selection, None, false, false).unwrap();
//         assert_eq!(results.len(), 7);
//         assert_results_has_value(&results, Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
//         assert_results_has_value(&results, Pos { x: 2, y: 0 }, CellValue::Number(3.into()));
//         assert_results_has_value(&results, Pos { x: 2, y: 1 }, CellValue::Number(6.into()));
//         assert_results_has_value(&results, Pos { x: 2, y: 2 }, CellValue::Number(9.into()));
//         assert_results_has_value(&results, Pos { x: 0, y: 4 }, CellValue::Number(1.into()));
//         assert_results_has_value(&results, Pos { x: 1, y: 4 }, CellValue::Number(2.into()));
//         assert_results_has_value(&results, Pos { x: 2, y: 4 }, CellValue::Number(3.into()));
//     }

//     #[test]
//     #[parallel]
//     fn selection_bounds() {
//         let mut sheet = Sheet::test();
//         let sheet_id = sheet.id;

//         let selection = OldSelection {
//             sheet_id,
//             ..Default::default()
//         };
//         assert_eq!(sheet.selection_bounds(&selection), None);

//         sheet.test_set_values(0, 0, 2, 2, vec!["1", "2", "a", "b"]);
//         sheet.test_set_code_run_array(-1, -1, vec!["c", "d", "e"], true);

//         let selection = OldSelection {
//             sheet_id,
//             rects: Some(vec![Rect::from_numbers(-4, -4, 10, 10)]),
//             ..Default::default()
//         };
//         assert_eq!(
//             sheet.selection_bounds(&selection),
//             Some(Rect::from_numbers(-4, -4, 10, 10))
//         );

//         let selection = OldSelection {
//             sheet_id,
//             columns: Some(vec![-1, 0]),
//             ..Default::default()
//         };
//         assert_eq!(
//             sheet.selection_bounds(&selection),
//             Some(Rect::from_numbers(-1, -1, 2, 3))
//         );

//         let selection = OldSelection {
//             sheet_id,
//             columns: Some(vec![5, 6]),
//             ..Default::default()
//         };
//         assert_eq!(sheet.selection_bounds(&selection), None);

//         let selection = OldSelection {
//             sheet_id,
//             rows: Some(vec![-1, 0]),
//             ..Default::default()
//         };
//         assert_eq!(
//             sheet.selection_bounds(&selection),
//             Some(Rect {
//                 min: Pos { x: -1, y: -1 },
//                 max: Pos { x: 1, y: 0 },
//             })
//         );

//         let selection = OldSelection {
//             sheet_id,
//             rows: Some(vec![-10, -11]),
//             ..Default::default()
//         };
//         assert_eq!(sheet.selection_bounds(&selection), None);
//     }

//     #[test]
//     #[parallel]
//     fn format_selection() {
//         let mut sheet = Sheet::test();
//         let sheet_id = sheet.id;

//         let selection = OldSelection {
//             sheet_id,
//             ..Default::default()
//         };
//         assert_eq!(sheet.format_selection(&selection), vec![]);

//         sheet.test_set_format(
//             0,
//             0,
//             FormatUpdate {
//                 bold: Some(Some(true)),
//                 ..Default::default()
//             },
//         );
//         sheet.test_set_format(
//             1,
//             1,
//             FormatUpdate {
//                 bold: Some(Some(false)),
//                 ..Default::default()
//             },
//         );

//         let selection = OldSelection {
//             sheet_id,
//             rects: Some(vec![Rect::from_numbers(0, 0, 2, 2)]),
//             ..Default::default()
//         };

//         let result = sheet.format_selection(&selection);
//         assert_eq!(result.len(), 2);
//         assert!(result
//             .iter()
//             .any(|(pos, value)| { *pos == Pos { x: 0, y: 0 } && value.bold == Some(true) }));
//         assert!(result
//             .iter()
//             .any(|(pos, value)| { *pos == Pos { x: 1, y: 1 } && value.bold == Some(false) }));

//         let selection = OldSelection {
//             sheet_id,
//             columns: Some(vec![0, 1]),
//             ..Default::default()
//         };
//         let results = sheet.format_selection(&selection);
//         assert_eq!(results.len(), 2);
//         assert!(results
//             .iter()
//             .any(|(pos, value)| { *pos == Pos { x: 0, y: 0 } && value.bold == Some(true) }));
//         assert!(results
//             .iter()
//             .any(|(pos, value)| { *pos == Pos { x: 1, y: 1 } && value.bold == Some(false) }));

//         let selection = OldSelection {
//             sheet_id,
//             rows: Some(vec![0, 1]),
//             ..Default::default()
//         };
//         let results = sheet.format_selection(&selection);
//         assert_eq!(results.len(), 2);
//         assert!(results
//             .iter()
//             .any(|(pos, format)| *pos == Pos { x: 0, y: 0 } && format.bold == Some(true)),);
//         assert!(results
//             .iter()
//             .any(|(pos, format)| *pos == Pos { x: 1, y: 1 } && format.bold == Some(false)));
//     }

//     #[test]
//     #[parallel]
//     fn test_selection_rects_values() {
//         let mut sheet = Sheet::test();
//         let sheet_id = sheet.id;

//         let selection = OldSelection {
//             sheet_id,
//             ..Default::default()
//         };
//         assert_eq!(sheet.selection_rects_values(&selection), vec![]);

//         sheet.test_set_values(0, 0, 2, 2, vec!["1", "2", "a", "b"]);
//         sheet.test_set_code_run_array(-1, -1, vec!["c", "d", "e"], true);

//         let selection = OldSelection {
//             sheet_id,
//             rects: Some(vec![Rect::from_numbers(-4, -4, 10, 10)]),
//             ..Default::default()
//         };
//         assert_eq!(
//             sheet.selection_rects_values(&selection),
//             vec![Rect::from_numbers(-4, -4, 10, 10)]
//         );

//         let selection = OldSelection {
//             sheet_id,
//             columns: Some(vec![-1, 0]),
//             ..Default::default()
//         };
//         // note, this includes the CodeRuns bounds as well because of a
//         // limitation in sheet.column_bounds
//         assert_eq!(
//             sheet.selection_rects_values(&selection),
//             vec![Rect::new(-1, -1, -1, 1), Rect::new(0, 0, 0, 1)]
//         );

//         let selection = OldSelection {
//             sheet_id,
//             columns: Some(vec![5, 6]),
//             ..Default::default()
//         };
//         assert_eq!(sheet.selection_rects_values(&selection), vec![]);

//         let selection = OldSelection {
//             sheet_id,
//             rows: Some(vec![-1, 0]),
//             ..Default::default()
//         };
//         assert_eq!(
//             sheet.selection_rects_values(&selection),
//             vec![Rect::new(-1, -1, -1, -1), Rect::new(-1, 0, 1, 0)]
//         );

//         let selection = OldSelection {
//             sheet_id,
//             rows: Some(vec![-10, -11]),
//             ..Default::default()
//         };
//         assert_eq!(sheet.selection_rects_values(&selection), vec![]);
//     }

//     #[test]
//     #[parallel]
//     fn selection_blanks() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_values(0, 0, 2, 2, vec!["1", "", "3", ""]);

//         let selection = OldSelection {
//             sheet_id: sheet.id,
//             x: 0,
//             y: 0,
//             rects: Some(vec![Rect::new(0, 0, 1, 1)]),
//             rows: None,
//             columns: None,
//             all: false,
//         };

//         let results = sheet.selection(&selection, None, false, true).unwrap();
//         assert_eq!(results.len(), 4);
//         assert_results_has_value(&results, Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
//         assert_results_has_value(&results, Pos { x: 1, y: 0 }, CellValue::Blank);
//         assert_results_has_value(&results, Pos { x: 0, y: 1 }, CellValue::Number(3.into()));
//         assert_results_has_value(&results, Pos { x: 1, y: 1 }, CellValue::Blank);
//     }
// }
