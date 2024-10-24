use super::Sheet;

impl Sheet {
    /// Sets a test value in the sheet of &str converted to a BigDecimal.
    #[cfg(test)]
    pub fn test_set_value_number(&mut self, x: i64, y: i64, s: &str) {
        use crate::{CellValue, Pos};
        use bigdecimal::BigDecimal;
        use std::str::FromStr;

        if s.is_empty() {
            return;
        }
        let value = if let Ok(bd) = BigDecimal::from_str(s) {
            CellValue::Number(bd)
        } else {
            CellValue::Text(s.to_string())
        };

        self.set_cell_value(Pos { x, y }, value);
    }

    /// Sets values in a rectangle starting at (x, y) with width w and height h.
    /// Rectangle is formed row first (so for x then for y).
    #[cfg(test)]
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
        self.calculate_bounds();
    }

    #[cfg(test)]
    pub fn test_set_format(
        &mut self,
        x: i64,
        y: i64,
        update: crate::grid::formats::format_update::FormatUpdate,
    ) {
        self.set_format_cell(crate::grid::Pos { x, y }, &update, true);
    }

    /// Sets a code run and CellValue::Code with an empty code string, a single value result.
    #[cfg(test)]
    pub fn test_set_code_run_single(&mut self, x: i64, y: i64, value: crate::grid::CellValue) {
        self.set_cell_value(
            crate::Pos { x, y },
            crate::CellValue::Code(crate::CodeCellValue {
                language: crate::grid::CodeCellLanguage::Formula,
                code: "".to_string(),
            }),
        );

        self.set_code_run(
            crate::Pos { x, y },
            Some(crate::grid::CodeRun {
                std_out: None,
                std_err: None,
                formatted_code_string: None,
                cells_accessed: Default::default(),
                result: crate::grid::CodeRunResult::Ok(crate::Value::Single(value)),
                return_type: Some("number".into()),
                line_number: None,
                output_type: None,
                spill_error: false,
                last_modified: chrono::Utc::now(),
            }),
        );
    }

    /// Sets a code run and CellValue::Code with an empty code string and a single value BigDecimal::from_str(n) result.
    #[cfg(test)]
    pub fn test_set_code_run_number(&mut self, x: i64, y: i64, n: &str) {
        use std::str::FromStr;

        self.test_set_code_run_single(
            x,
            y,
            crate::grid::CellValue::Number(bigdecimal::BigDecimal::from_str(n).unwrap()),
        );
    }

    /// Sets a code run array with code string of "" and an array output of the given values.
    #[cfg(test)]
    pub fn test_set_code_run_array(&mut self, x: i64, y: i64, n: Vec<&str>, vertical: bool) {
        use crate::{
            grid::{CodeCellLanguage, CodeRun, CodeRunResult},
            Array, ArraySize, CellValue, CodeCellValue, Pos, Value,
        };
        use bigdecimal::BigDecimal;
        use chrono::Utc;
        use std::str::FromStr;

        let array_size = if vertical {
            ArraySize::new(1, n.len() as u32).unwrap()
        } else {
            ArraySize::new(n.len() as u32, 1).unwrap()
        };
        let mut array = Array::new_empty(array_size);
        for (i, s) in n.iter().enumerate() {
            if !s.is_empty() {
                let value = if let Ok(bd) = BigDecimal::from_str(s) {
                    CellValue::Number(bd)
                } else {
                    CellValue::Text(s.to_string())
                };
                if vertical {
                    let _ = array.set(0, i as u32, value);
                } else {
                    let _ = array.set(i as u32, 0, value);
                }
            }
        }
        self.set_cell_value(
            Pos { x, y },
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "code".to_string(),
            }),
        );
        self.set_code_run(
            Pos { x, y },
            Some(CodeRun {
                std_out: None,
                std_err: None,
                formatted_code_string: None,
                cells_accessed: Default::default(),
                result: CodeRunResult::Ok(Value::Array(array)),
                return_type: Some("number".into()),
                line_number: None,
                output_type: None,
                spill_error: false,
                last_modified: Utc::now(),
            }),
        );
    }

    #[cfg(test)]
    pub fn test_set_code_run_array_2d(&mut self, x: i64, y: i64, w: u32, h: u32, n: Vec<&str>) {
        use crate::{
            grid::{CodeCellLanguage, CodeRun, CodeRunResult},
            Array, ArraySize, CellValue, CodeCellValue, Pos, Value,
        };
        use bigdecimal::BigDecimal;
        use chrono::Utc;
        use std::str::FromStr;

        self.set_cell_value(
            Pos { x, y },
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "code".to_string(),
            }),
        );

        let array_size = ArraySize::new(w, h).unwrap();
        let mut array = Array::new_empty(array_size);
        for (i, s) in n.iter().enumerate() {
            if !s.is_empty() {
                let value = if let Ok(bd) = BigDecimal::from_str(s) {
                    CellValue::Number(bd)
                } else {
                    CellValue::Text(s.to_string())
                };
                array.set(i as u32 % w, i as u32 / w, value).unwrap();
            }
        }

        self.set_code_run(
            Pos { x, y },
            Some(CodeRun {
                std_out: None,
                std_err: None,
                formatted_code_string: None,
                cells_accessed: Default::default(),
                result: CodeRunResult::Ok(Value::Array(array)),
                return_type: Some("number".into()),
                line_number: None,
                output_type: None,
                spill_error: false,
                last_modified: Utc::now(),
            }),
        );
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use bigdecimal::BigDecimal;

    use crate::{grid::Sheet, CellValue, Pos};
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_set_value() {
        let mut sheet = Sheet::test();
        sheet.test_set_value_number(0, 0, "1");
        assert_eq!(
            sheet.cell_value_ref(Pos { x: 0, y: 0 }),
            Some(&CellValue::Number(BigDecimal::from(1)))
        );
        sheet.test_set_value_number(0, 0, "hello");
        assert_eq!(
            sheet.cell_value_ref(Pos { x: 0, y: 0 }),
            Some(&CellValue::Text("hello".to_string()))
        );
    }

    #[test]
    #[parallel]
    fn test_set_values() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(0, 0, 2, 2, vec!["1", "2", "3", "4"]);
        assert_eq!(
            sheet.cell_value_ref(Pos { x: 0, y: 0 }),
            Some(&CellValue::Number(BigDecimal::from(1)))
        );
        assert_eq!(
            sheet.cell_value_ref(Pos { x: 1, y: 0 }),
            Some(&CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(
            sheet.cell_value_ref(Pos { x: 0, y: 1 }),
            Some(&CellValue::Number(BigDecimal::from(3)))
        );
        assert_eq!(
            sheet.cell_value_ref(Pos { x: 1, y: 1 }),
            Some(&CellValue::Number(BigDecimal::from(4)))
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
    #[parallel]
    fn test_set_code_run_array_horizontal() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_array(-1, -1, vec!["1", "2", "3"], false);
        assert_eq!(
            sheet.display_value(Pos { x: -1, y: -1 }),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: -1 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: -1 }),
            Some(CellValue::Number(BigDecimal::from(3)))
        );
    }

    #[test]
    #[parallel]
    fn test_set_code_run_array_vertical() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_array(-1, -1, vec!["1", "2", "3"], true);
        assert_eq!(
            sheet.display_value(Pos { x: -1, y: -1 }),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: -1, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: -1, y: 1 }),
            Some(CellValue::Number(BigDecimal::from(3)))
        );
    }

    #[test]
    #[parallel]
    fn test_set_code_run_empty() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_number(0, 0, "11");
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from_str("11").unwrap()))
        );
    }

    #[test]
    #[parallel]
    fn test_set_cell_number_empty() {
        let mut sheet = Sheet::test();
        sheet.test_set_value_number(0, 0, "");
        assert!(sheet.cell_value(Pos { x: 0, y: 0 }).is_none());
    }

    #[test]
    #[parallel]
    fn test_set_code_run_array_2d() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_array_2d(-1, -1, 2, 2, vec!["1", "2", "3", "4"]);
        assert_eq!(
            sheet.display_value(Pos { x: -1, y: -1 }),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: -1 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: -1, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(3)))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(4)))
        );
    }
}
