use crate::{cell_values::CellValues, CellValue, Pos};

use super::Sheet;

impl Sheet {
    /// Replace cell_values with CellValues.
    ///
    /// Returns the old CellValues.
    pub fn merge_cell_values(&mut self, pos: Pos, cell_values: &CellValues) -> CellValues {
        let mut old = CellValues::new(cell_values.w, cell_values.h);
        for x in 0..cell_values.w {
            let col = self.get_or_create_column((x as i64) + pos.x);
            for y in 0..cell_values.h {
                let old_value = if let Some(value) = cell_values.get_except_blank(x, y) {
                    col.values.insert(pos.y + y as i64, value.clone())
                } else {
                    col.values.remove(&(pos.y + y as i64))
                };
                if let Some(old_value) = old_value {
                    old.set(x, y, old_value);
                }
            }
        }
        old
    }

    /// Returns the rendered value of the cell at the given position. This is
    /// different from calling CellValue.to_display() since it properly formats
    /// numbers. (We no longer format numbers in Rust because the client needs to
    /// be able to change the precision of the number when rendering.)
    pub fn rendered_value(&self, pos: Pos) -> Option<String> {
        let value = self.display_value(pos)?;
        match value {
            CellValue::Number(_) => {
                let format = self.format_cell(pos.x, pos.y, true);
                Some(value.to_number_display(
                    format.numeric_format,
                    format.numeric_decimals,
                    format.numeric_commas,
                ))
            }
            _ => Some(value.to_display()),
        }
    }
}

#[cfg(test)]
mod test {
    use std::str::FromStr;

    use crate::{
        grid::{formats::format_update::FormatUpdate, NumericFormat},
        CellValue,
    };

    use super::*;
    use bigdecimal::BigDecimal;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn merge_cell_values() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: -1, y: -2 }, "old-a");
        sheet.set_cell_value(Pos { x: -1, y: -1 }, "old-b");
        sheet.set_cell_value(Pos { x: 0, y: -2 }, "old-c");
        sheet.set_cell_value(Pos { x: 0, y: -1 }, "old-d");
        let cell_values = CellValues::from(vec![vec!["a", "b"], vec!["c", "d"]]);

        let old = sheet.merge_cell_values(Pos { x: -1, y: -2 }, &cell_values);
        assert_eq!(old.w, 2);
        assert_eq!(old.h, 2);

        assert_eq!(
            sheet.cell_value(Pos { x: -1, y: -2 }),
            Some(CellValue::from("a"))
        );
        assert_eq!(
            sheet.cell_value(Pos { x: -1, y: -1 }),
            Some(CellValue::from("b"))
        );
        assert_eq!(
            sheet.cell_value(Pos { x: 0, y: -2 }),
            Some(CellValue::from("c"))
        );
        assert_eq!(
            sheet.cell_value(Pos { x: 0, y: -1 }),
            Some(CellValue::from("d"))
        );

        assert_eq!(
            old,
            CellValues::from(vec![vec!["old-a", "old-b"], vec!["old-c", "old-d"]])
        );
    }

    #[test]
    fn rendered_value() {
        let mut sheet = Sheet::test();
        let pos = Pos { x: 0, y: 0 };
        sheet.set_cell_value(
            pos,
            CellValue::Number(BigDecimal::from_str("123.456").unwrap()),
        );

        sheet.set_format_cell(
            pos,
            &FormatUpdate {
                numeric_format: Some(Some(NumericFormat {
                    kind: crate::grid::NumericFormatKind::Currency,
                    symbol: Some("$".to_string()),
                })),
                ..Default::default()
            },
            false,
        );

        // no format for to_display
        assert_eq!(
            sheet.display_value(pos).unwrap().to_display(),
            "123.456".to_string()
        );

        // format for to_rendered
        assert_eq!(sheet.rendered_value(pos).unwrap(), "$123.46".to_string());
    }
}
