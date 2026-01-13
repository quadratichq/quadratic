//! Test utilities to create values, tables, and charts directly in a sheet.

use super::Sheet;

use crate::{
    Array, ArraySize, CellValue, Pos, Value,
    cellvalue::Import,
    grid::{CodeCellLanguage, CodeRun, DataTable, DataTableKind},
    number::decimal_from_str,
};

#[cfg(test)]
impl Sheet {
    /// Sets a test value in the sheet of &str converted to a Decimal.
    pub fn test_set_value_number(&mut self, x: i64, y: i64, s: &str) {
        if s.is_empty() {
            return;
        }
        let value = if let Ok(bd) = decimal_from_str(s) {
            CellValue::Number(bd)
        } else {
            CellValue::Text(s.to_string())
        };

        self.set_value(Pos { x, y }, value);
    }

    /// Sets values in a rectangle starting at (x, y) with width w and height h.
    /// Rectangle is formed row first (so for x then for y).
    pub fn test_set_values(&mut self, x: i64, y: i64, w: i64, h: i64, s: Vec<&str>) {
        assert!(
            w * h == s.len() as i64,
            "Expected array to be same size as w * h in set_values"
        );
        for xx in 0..w {
            for yy in 0..h {
                let value = s[(yy * w + xx) as usize];
                if !value.is_empty() {
                    self.test_set_value_number(x + xx, y + yy, value);
                }
            }
        }
        let a1_context = self.expensive_make_a1_context();
        self.recalculate_bounds(&a1_context);
    }

    /// Sets a code run and CellValue::Code with an empty code string, a single value result.
    pub fn test_set_code_run_single(&mut self, x: i64, y: i64, value: CellValue) {
        let code_run = CodeRun {
            language: CodeCellLanguage::Formula,
            code: "".to_string(),
            formula_ast: None,
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };

        self.set_data_table(
            crate::Pos { x, y },
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run),
                "Table1",
                Value::Single(value),
                false,
                Some(false),
                Some(false),
                None,
            )),
        );
    }

    /// Sets a code run and CellValue::Code with an empty code string and a single value from_str(n) result.
    pub fn test_set_code_run_number(&mut self, x: i64, y: i64, n: &str) {
        self.test_set_code_run_single(x, y, CellValue::Number(decimal_from_str(n).unwrap()));
    }

    /// Sets a code run array with code string of "" and an array output of the given values.
    pub fn test_set_code_run_array(&mut self, x: i64, y: i64, n: Vec<&str>, vertical: bool) {
        let array_size = if vertical {
            ArraySize::new(1, n.len() as u32).unwrap()
        } else {
            ArraySize::new(n.len() as u32, 1).unwrap()
        };
        let mut array = Array::new_empty(array_size);
        for (i, s) in n.iter().enumerate() {
            if !s.is_empty() {
                let value = if let Ok(bd) = decimal_from_str(s) {
                    CellValue::Number(bd)
                } else {
                    CellValue::Text(s.to_string())
                };
                if vertical {
                    let _ = array.set(0, i as u32, value, false);
                } else {
                    let _ = array.set(i as u32, 0, value, false);
                }
            }
        }
        let code_run = CodeRun {
            language: CodeCellLanguage::Formula,
            code: "".to_string(),
            formula_ast: None,
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };

        self.set_data_table(
            Pos { x, y },
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run),
                "Table1",
                array.into(),
                false,
                Some(false),
                Some(false),
                None,
            )),
        );
        let a1_context = self.expensive_make_a1_context();
        self.recalculate_bounds(&a1_context);
    }

    pub fn test_set_code_run_array_2d(&mut self, x: i64, y: i64, w: u32, h: u32, n: Vec<&str>) {
        let array_size = ArraySize::new(w, h).unwrap();
        let mut array = Array::new_empty(array_size);
        for (i, s) in n.iter().enumerate() {
            if !s.is_empty() {
                let value = if let Ok(bd) = decimal_from_str(s) {
                    CellValue::Number(bd)
                } else {
                    CellValue::Text(s.to_string())
                };
                array.set(i as u32 % w, i as u32 / w, value, false).unwrap();
            }
        }

        let code_run = CodeRun {
            language: CodeCellLanguage::Formula,
            code: "code".to_string(),
            formula_ast: None,
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };

        self.set_data_table(
            Pos { x, y },
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run),
                "Table1",
                array.into(),
                false,
                Some(false),
                Some(false),
                None,
            )),
        );
    }

    /// Sets a JS chart at the given position with the given width and height (in cells).
    pub fn test_set_chart(&mut self, pos: Pos, w: u32, h: u32) {
        let code_run = CodeRun {
            language: CodeCellLanguage::Javascript,
            code: "code".to_string(),
            formula_ast: None,
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: None,
            line_number: None,
            output_type: None,
        };
        self.set_data_table(
            pos,
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run),
                &format!("Chart {}", self.data_tables.len() + 1),
                Value::Single(CellValue::Image("chart".to_string())),
                false,
                Some(true),
                Some(true),
                Some((w, h)),
            )),
        );
    }

    /// Sets a JS chart at the given position with the given width and height (in cells).
    pub fn test_set_chart_html(&mut self, pos: Pos, w: u32, h: u32) {
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "code".to_string(),
            formula_ast: None,
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: None,
            line_number: None,
            output_type: None,
        };
        self.set_data_table(
            pos,
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run),
                &format!("Chart {}", self.data_tables.len() + 1),
                Value::Single(CellValue::Html("chart".to_string())),
                false,
                Some(true),
                Some(true),
                Some((w, h)),
            )),
        );
    }

    /// Sets an empty data table on the sheet.
    pub fn test_set_data_table(
        &mut self,
        pos: Pos,
        w: u32,
        h: u32,
        header_is_first_row: bool,
        show_name: Option<bool>,
        show_columns: Option<bool>,
    ) {
        let value = Value::Array(Array::new_empty(ArraySize::new(w, h).unwrap()));
        self.set_data_table(
            pos,
            Some(DataTable::new(
                DataTableKind::Import(Import {
                    file_name: "test".to_string(),
                }),
                "Table1",
                value,
                header_is_first_row,
                show_name,
                show_columns,
                None,
            )),
        );
    }
}

#[cfg(test)]
mod tests {
    use crate::{CellValue, Pos, grid::Sheet, number::decimal_from_str};

    #[test]
    fn test_set_value() {
        let mut sheet = Sheet::test();
        sheet.test_set_value_number(0, 0, "1");
        assert_eq!(
            sheet.cell_value_ref(Pos { x: 0, y: 0 }),
            Some(&CellValue::Number(1.into()))
        );
        sheet.test_set_value_number(0, 0, "hello");
        assert_eq!(
            sheet.cell_value_ref(Pos { x: 0, y: 0 }),
            Some(&CellValue::Text("hello".to_string()))
        );
    }

    #[test]
    fn test_set_values() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(0, 0, 2, 2, vec!["1", "2", "3", "4"]);
        assert_eq!(
            sheet.cell_value_ref(Pos { x: 0, y: 0 }),
            Some(&CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.cell_value_ref(Pos { x: 1, y: 0 }),
            Some(&CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.cell_value_ref(Pos { x: 0, y: 1 }),
            Some(&CellValue::Number(3.into()))
        );
        assert_eq!(
            sheet.cell_value_ref(Pos { x: 1, y: 1 }),
            Some(&CellValue::Number(4.into()))
        );

        sheet.test_set_values(-10, -10, 2, 2, vec!["a", "b", "c", "d"]);
        assert_eq!(
            sheet.cell_value_ref(Pos { x: -10, y: -10 }),
            Some(&CellValue::Text("a".to_string()))
        );
        assert_eq!(
            sheet.cell_value_ref(Pos { x: -9, y: -10 }),
            Some(&CellValue::Text("b".to_string()))
        );
        assert_eq!(
            sheet.cell_value_ref(Pos { x: -10, y: -9 }),
            Some(&CellValue::Text("c".to_string()))
        );
        assert_eq!(
            sheet.cell_value_ref(Pos { x: -9, y: -9 }),
            Some(&CellValue::Text("d".to_string()))
        );

        sheet.test_set_values(-10, -10, 1, 3, vec!["a", "b", "c"]);
        assert_eq!(
            sheet.cell_value_ref(Pos { x: -10, y: -10 }),
            Some(&CellValue::Text("a".to_string()))
        );
        assert_eq!(
            sheet.cell_value_ref(Pos { x: -10, y: -9 }),
            Some(&CellValue::Text("b".to_string()))
        );
        assert_eq!(
            sheet.cell_value_ref(Pos { x: -10, y: -8 }),
            Some(&CellValue::Text("c".to_string()))
        );
    }

    #[test]
    fn test_set_code_run_array_horizontal() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_array(1, 1, vec!["1", "2", "3"], false);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 3, y: 1 }),
            Some(CellValue::Number(3.into()))
        );
    }

    #[test]
    fn test_set_code_run_array_vertical() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_array(1, 1, vec!["1", "2", "3"], true);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 3 }),
            Some(CellValue::Number(3.into()))
        );
    }

    #[test]
    fn test_set_code_run_empty() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_number(1, 1, "11");
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(decimal_from_str("11").unwrap()))
        );
    }

    #[test]
    fn test_set_cell_number_empty() {
        let mut sheet = Sheet::test();
        sheet.test_set_value_number(0, 0, "");
        assert!(sheet.cell_value(Pos { x: 0, y: 0 }).is_none());
    }

    #[test]
    fn test_set_code_run_array_2d() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_array_2d(1, 1, 2, 2, vec!["1", "2", "3", "4"]);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Number(3.into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 2 }),
            Some(CellValue::Number(4.into()))
        );
    }
}
