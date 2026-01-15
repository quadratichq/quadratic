//! Conditional format evaluation for rendering.

use crate::{
    CellValue, Pos, Rect, RefAdjust, SheetPos, Value,
    a1::A1Context,
    controller::GridController,
    formulas::{Ctx, adjust_references, parse_formula},
    grid::{
        SheetId,
        js_types::JsRenderCell,
        sheet::conditional_format::{ConditionalFormat, ConditionalFormatStyle},
    },
};

impl GridController {
    /// Evaluates a conditional format rule at a specific cell position.
    /// Translates the formula references relative to the anchor (selection cursor).
    fn evaluate_conditional_format_rule(
        &self,
        cf: &ConditionalFormat,
        sheet_pos: SheetPos,
        a1_context: &A1Context,
    ) -> bool {
        let anchor = cf.selection.cursor;

        // Calculate offset from anchor to current position
        let dx = sheet_pos.x - anchor.x;
        let dy = sheet_pos.y - anchor.y;

        // If no translation needed, evaluate directly
        if dx == 0 && dy == 0 {
            let mut ctx = Ctx::new_for_conditional_format(self, sheet_pos);
            let result = cf.rule.eval(&mut ctx);
            return is_truthy(&result.inner);
        }

        // Get the original formula string from the AST
        let formula_string = cf.rule.to_a1_string(Some(sheet_pos.sheet_id), a1_context);

        // Adjust references by the offset (relative_only = true to only adjust relative refs)
        let adjust = RefAdjust {
            sheet_id: None, // Adjust all sheets
            relative_only: true,
            dx,
            dy,
            x_start: 0,
            y_start: 0,
        };

        let anchor_pos = anchor.to_sheet_pos(sheet_pos.sheet_id);
        let adjusted_formula =
            adjust_references(&formula_string, sheet_pos.sheet_id, a1_context, anchor_pos, adjust);

        // Parse and evaluate the adjusted formula
        match parse_formula(&adjusted_formula, a1_context, sheet_pos) {
            Ok(parsed) => {
                let mut ctx = Ctx::new_for_conditional_format(self, sheet_pos);
                let result = parsed.eval(&mut ctx);
                is_truthy(&result.inner)
            }
            Err(_) => false,
        }
    }

    /// Evaluates all conditional formats that apply to a cell and returns
    /// the combined style to apply. Later rules override earlier ones.
    pub fn get_conditional_format_style(
        &self,
        sheet_pos: SheetPos,
        a1_context: &A1Context,
    ) -> Option<ConditionalFormatStyle> {
        let Some(sheet) = self.try_sheet(sheet_pos.sheet_id) else {
            return None;
        };

        // Get all conditional formats that might apply to this cell
        let pos = Pos {
            x: sheet_pos.x,
            y: sheet_pos.y,
        };

        let formats: Vec<&ConditionalFormat> = sheet
            .conditional_formats
            .iter()
            .filter(|cf| cf.selection.contains_pos(pos, a1_context))
            .collect();

        if formats.is_empty() {
            return None;
        }

        let mut combined_style = ConditionalFormatStyle::default();
        let mut any_applied = false;

        for cf in formats {
            // Evaluate the formula with translated references
            if self.evaluate_conditional_format_rule(cf, sheet_pos, a1_context) {
                // Apply the style (later rules override earlier ones)
                if cf.style.bold.is_some() {
                    combined_style.bold = cf.style.bold;
                }
                if cf.style.italic.is_some() {
                    combined_style.italic = cf.style.italic;
                }
                if cf.style.underline.is_some() {
                    combined_style.underline = cf.style.underline;
                }
                if cf.style.strike_through.is_some() {
                    combined_style.strike_through = cf.style.strike_through;
                }
                if cf.style.text_color.is_some() {
                    combined_style.text_color = cf.style.text_color.clone();
                }
                if cf.style.fill_color.is_some() {
                    combined_style.fill_color = cf.style.fill_color.clone();
                }
                any_applied = true;
            }
        }

        if any_applied {
            Some(combined_style)
        } else {
            None
        }
    }

    /// Applies conditional formatting styles to a vector of render cells.
    /// Modifies the cells in place to include any conditional formatting.
    pub fn apply_conditional_formatting_to_cells(
        &self,
        sheet_id: SheetId,
        cells: &mut Vec<JsRenderCell>,
    ) {
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return;
        };

        // Skip if no conditional formats
        if sheet.conditional_formats.is_empty() {
            return;
        }

        let a1_context = self.a1_context();

        for cell in cells.iter_mut() {
            let pos = Pos { x: cell.x, y: cell.y };
            let sheet_pos = pos.to_sheet_pos(sheet_id);

            if let Some(style) = self.get_conditional_format_style(sheet_pos, a1_context) {
                // Apply the conditional format style, overriding existing values
                if let Some(bold) = style.bold {
                    cell.bold = Some(bold);
                }
                if let Some(italic) = style.italic {
                    cell.italic = Some(italic);
                }
                if let Some(underline) = style.underline {
                    cell.underline = Some(underline);
                }
                if let Some(strike_through) = style.strike_through {
                    cell.strike_through = Some(strike_through);
                }
                if let Some(text_color) = style.text_color {
                    cell.text_color = Some(text_color);
                }
                // Note: fill_color is handled separately via fills rendering
            }
        }
    }

    /// Gets all conditional format fills for cells within a rect.
    /// Returns a list of (pos, fill_color) tuples for cells where conditional
    /// formatting applies and has a fill color.
    pub fn get_conditional_format_fills(
        &self,
        sheet_id: crate::grid::SheetId,
        rect: Rect,
        a1_context: &A1Context,
    ) -> Vec<(Pos, String)> {
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return vec![];
        };

        // Check if there are any conditional formats with fill colors
        let formats_with_fills: Vec<&ConditionalFormat> = sheet
            .conditional_formats
            .iter()
            .filter(|cf| cf.style.fill_color.is_some())
            .collect();

        if formats_with_fills.is_empty() {
            return vec![];
        }

        let mut fills = Vec::new();

        for y in rect.y_range() {
            for x in rect.x_range() {
                let pos = Pos { x, y };
                let sheet_pos = pos.to_sheet_pos(sheet_id);

                // Track the last matching fill for this position
                // (later rules override earlier ones)
                let mut last_fill: Option<String> = None;

                // Check each format with a fill color (in order, first to last)
                for cf in &formats_with_fills {
                    if cf.selection.contains_pos(pos, a1_context) {
                        // Evaluate the formula with translated references
                        if self.evaluate_conditional_format_rule(cf, sheet_pos, a1_context) {
                            if let Some(fill_color) = &cf.style.fill_color {
                                // Later rules override earlier ones
                                last_fill = Some(fill_color.clone());
                            }
                        }
                    }
                }

                // Add the last matching fill if any
                if let Some(fill_color) = last_fill {
                    fills.push((pos, fill_color));
                }
            }
        }

        fills
    }
}

/// Checks if a Value is truthy (for conditional format evaluation).
fn is_truthy(value: &Value) -> bool {
    match value {
        Value::Single(cell_value) => is_cell_value_truthy(cell_value),
        Value::Array(array) => {
            // For arrays, check if the first element is truthy
            if let Ok(first) = array.get(0, 0) {
                is_cell_value_truthy(first)
            } else {
                false
            }
        }
        Value::Tuple(_) => false,
        Value::Lambda(_) => false,
    }
}

/// Checks if a CellValue is truthy.
fn is_cell_value_truthy(value: &CellValue) -> bool {
    match value {
        CellValue::Blank => false,
        CellValue::Text(s) => !s.is_empty(),
        CellValue::Number(n) => !n.is_zero(),
        CellValue::Logical(b) => *b,
        CellValue::Error(_) => false,
        CellValue::Html(_) => true,
        CellValue::Image(_) => true,
        CellValue::Date(_) => true,
        CellValue::Time(_) => true,
        CellValue::DateTime(_) => true,
        CellValue::Duration(_) => true,
        CellValue::RichText(_) => true,
        CellValue::Instant(_) => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        Rect,
        a1::A1Selection,
        controller::GridController,
        formulas::parse_formula,
        grid::sheet::conditional_format::{ConditionalFormat, ConditionalFormatStyle},
    };
    use uuid::Uuid;

    fn create_test_conditional_format(
        gc: &GridController,
        selection: &str,
        formula: &str,
        style: ConditionalFormatStyle,
    ) -> ConditionalFormat {
        let sheet_id = gc.sheet_ids()[0];
        // Use test_a1_sheet_id to create selection with the correct sheet_id
        let a1_selection = A1Selection::test_a1_sheet_id(selection, sheet_id);
        let pos = a1_selection.cursor.to_sheet_pos(sheet_id);
        let rule = parse_formula(formula, gc.a1_context(), pos).unwrap();

        ConditionalFormat {
            id: Uuid::new_v4(),
            selection: a1_selection,
            style,
            rule,
        }
    }

    #[test]
    fn test_get_conditional_format_style_truthy() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set a value in A1 - use pos! macro to get correct position
        let pos_a1 = crate::Pos::test_a1("A1");
        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "10".to_string(), None, false);

        // Create a conditional format that always applies (TRUE)
        let cf = create_test_conditional_format(
            &gc,
            "A1",
            "=TRUE",
            ConditionalFormatStyle {
                bold: Some(true),
                text_color: Some("red".to_string()),
                ..Default::default()
            },
        );

        // Add the conditional format to the sheet
        gc.sheet_mut(sheet_id).conditional_formats.set(cf.clone(), sheet_id);

        // Test that the style is applied
        let sheet_pos = pos_a1.to_sheet_pos(sheet_id);

        // Debug: check if selection contains the position
        let a1_context = gc.a1_context();
        let contains = cf.selection.contains_pos(pos_a1, a1_context);
        assert!(contains, "Selection should contain A1");

        let style = gc.get_conditional_format_style(sheet_pos, gc.a1_context());

        assert!(style.is_some(), "Style should be Some because formula is TRUE");
        let style = style.unwrap();
        assert_eq!(style.bold, Some(true));
        assert_eq!(style.text_color, Some("red".to_string()));
    }

    #[test]
    fn test_get_conditional_format_style_falsy() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");

        // Create a conditional format that never applies (FALSE)
        let cf = create_test_conditional_format(
            &gc,
            "A1",
            "=FALSE",
            ConditionalFormatStyle {
                bold: Some(true),
                ..Default::default()
            },
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // Test that the style is NOT applied (formula is FALSE)
        let sheet_pos = pos_a1.to_sheet_pos(sheet_id);
        let style = gc.get_conditional_format_style(sheet_pos, gc.a1_context());

        assert!(style.is_none());
    }

    #[test]
    fn test_apply_conditional_formatting_to_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");
        let pos_b1 = crate::Pos::test_a1("B1");

        // Set values
        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "10".to_string(), None, false);
        gc.set_cell_value(pos_b1.to_sheet_pos(sheet_id), "3".to_string(), None, false);

        // Create a conditional format that always applies (TRUE)
        let cf = create_test_conditional_format(
            &gc,
            "A1:B1",
            "=TRUE",
            ConditionalFormatStyle {
                bold: Some(true),
                italic: Some(true),
                ..Default::default()
            },
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // Get render cells for the range A1:B1
        let sheet = gc.sheet(sheet_id);
        let rect = Rect::new_span(pos_a1, pos_b1);
        let mut cells = sheet.get_render_cells(rect, gc.a1_context());

        // Apply conditional formatting
        gc.apply_conditional_formatting_to_cells(sheet_id, &mut cells);

        // Find the cells
        let cell_a1 = cells.iter().find(|c| c.x == pos_a1.x && c.y == pos_a1.y);
        let cell_b1 = cells.iter().find(|c| c.x == pos_b1.x && c.y == pos_b1.y);

        // Both should have conditional formatting applied since formula is TRUE
        assert!(cell_a1.is_some());
        let cell_a1 = cell_a1.unwrap();
        assert_eq!(cell_a1.bold, Some(true));
        assert_eq!(cell_a1.italic, Some(true));

        assert!(cell_b1.is_some());
        let cell_b1 = cell_b1.unwrap();
        assert_eq!(cell_b1.bold, Some(true));
        assert_eq!(cell_b1.italic, Some(true));
    }

    #[test]
    fn test_get_conditional_format_fills() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");

        // Set a value in A1
        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "10".to_string(), None, false);

        // Create a conditional format with fill color that always applies
        let cf = create_test_conditional_format(
            &gc,
            "A1",
            "=TRUE",
            ConditionalFormatStyle {
                fill_color: Some("green".to_string()),
                ..Default::default()
            },
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // Get fills
        let fills = gc.get_conditional_format_fills(
            sheet_id,
            Rect::new_span(pos_a1, pos_a1),
            gc.a1_context(),
        );

        assert_eq!(fills.len(), 1);
        assert_eq!(fills[0].0, pos_a1);
        assert_eq!(fills[0].1, "green".to_string());
    }

    #[test]
    fn test_conditional_format_no_fill_when_falsy() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");

        // Set a value in A1
        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "3".to_string(), None, false);

        // Create a conditional format with fill color that never applies
        let cf = create_test_conditional_format(
            &gc,
            "A1",
            "=FALSE",
            ConditionalFormatStyle {
                fill_color: Some("green".to_string()),
                ..Default::default()
            },
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // Get fills - should be empty since formula is FALSE
        let fills = gc.get_conditional_format_fills(
            sheet_id,
            Rect::new_span(pos_a1, pos_a1),
            gc.a1_context(),
        );

        assert!(fills.is_empty());
    }

    #[test]
    fn test_is_truthy() {
        use crate::Value;

        // Test truthy values
        assert!(is_truthy(&Value::Single(CellValue::Logical(true))));
        assert!(is_truthy(&Value::Single(CellValue::Number(
            rust_decimal::Decimal::from(1)
        ))));
        assert!(is_truthy(&Value::Single(CellValue::Text("hello".into()))));

        // Test falsy values
        assert!(!is_truthy(&Value::Single(CellValue::Logical(false))));
        assert!(!is_truthy(&Value::Single(CellValue::Number(
            rust_decimal::Decimal::ZERO
        ))));
        assert!(!is_truthy(&Value::Single(CellValue::Blank)));
        assert!(!is_truthy(&Value::Single(CellValue::Text("".into()))));
    }

    #[test]
    fn test_conditional_format_translates_references_in_range() {
        // Test that when a conditional format applies to a range, the formula
        // references are translated properly for each cell in the range.
        // Example: selection=A1:A3, formula=A1>5
        // - At A1: evaluates A1>5
        // - At A2: evaluates A2>5
        // - At A3: evaluates A3>5
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");
        let pos_a2 = crate::Pos::test_a1("A2");
        let pos_a3 = crate::Pos::test_a1("A3");

        // Set values: A1=10 (>5), A2=3 (<5), A3=7 (>5)
        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "10".to_string(), None, false);
        gc.set_cell_value(pos_a2.to_sheet_pos(sheet_id), "3".to_string(), None, false);
        gc.set_cell_value(pos_a3.to_sheet_pos(sheet_id), "7".to_string(), None, false);

        // Create a conditional format for A1:A3 with formula =A1>5
        // The formula is anchored at A1 (the cursor of the selection)
        let cf = create_test_conditional_format(
            &gc,
            "A1:A3",
            "=A1>5",
            ConditionalFormatStyle {
                bold: Some(true),
                ..Default::default()
            },
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // Check each cell - formula should be translated
        // A1: =A1>5 -> 10>5 -> true (should apply)
        let style_a1 = gc.get_conditional_format_style(pos_a1.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(style_a1.is_some(), "A1 (10>5) should have style applied");

        // A2: =A2>5 -> 3>5 -> false (should NOT apply)
        let style_a2 = gc.get_conditional_format_style(pos_a2.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(style_a2.is_none(), "A2 (3>5) should NOT have style applied");

        // A3: =A3>5 -> 7>5 -> true (should apply)
        let style_a3 = gc.get_conditional_format_style(pos_a3.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(style_a3.is_some(), "A3 (7>5) should have style applied");
    }

    #[test]
    fn test_conditional_format_absolute_references_not_translated() {
        // Test that absolute references ($A$1) are NOT translated
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");
        let pos_a2 = crate::Pos::test_a1("A2");

        // Set values: A1=10 (>5)
        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "10".to_string(), None, false);
        gc.set_cell_value(pos_a2.to_sheet_pos(sheet_id), "3".to_string(), None, false);

        // Create a conditional format for A1:A2 with formula =$A$1>5
        // The absolute reference should NOT be translated
        let cf = create_test_conditional_format(
            &gc,
            "A1:A2",
            "=$A$1>5",
            ConditionalFormatStyle {
                bold: Some(true),
                ..Default::default()
            },
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // Both cells should evaluate =$A$1>5 -> 10>5 -> true
        let style_a1 = gc.get_conditional_format_style(pos_a1.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(style_a1.is_some(), "A1 ($A$1>5 = 10>5) should have style applied");

        // A2 should also check $A$1>5 (absolute ref), not $A$2>5
        let style_a2 = gc.get_conditional_format_style(pos_a2.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(style_a2.is_some(), "A2 ($A$1>5 = 10>5, absolute ref) should have style applied");
    }

    #[test]
    fn test_conditional_format_fills_with_translated_references() {
        // Test that fills work correctly with translated references
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");
        let pos_a2 = crate::Pos::test_a1("A2");
        let pos_a3 = crate::Pos::test_a1("A3");

        // Set values: A1=10 (>5), A2=3 (<5), A3=7 (>5)
        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "10".to_string(), None, false);
        gc.set_cell_value(pos_a2.to_sheet_pos(sheet_id), "3".to_string(), None, false);
        gc.set_cell_value(pos_a3.to_sheet_pos(sheet_id), "7".to_string(), None, false);

        // Create a conditional format for A1:A3 with formula =A1>5
        let cf = create_test_conditional_format(
            &gc,
            "A1:A3",
            "=A1>5",
            ConditionalFormatStyle {
                fill_color: Some("green".to_string()),
                ..Default::default()
            },
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // Get fills for the entire range
        let fills = gc.get_conditional_format_fills(
            sheet_id,
            Rect::new_span(pos_a1, pos_a3),
            gc.a1_context(),
        );

        // Should have fills for A1 and A3 (values > 5), but not A2
        assert_eq!(fills.len(), 2, "Should have 2 fills (A1 and A3)");
        assert!(fills.iter().any(|(pos, _)| *pos == pos_a1), "A1 should have fill");
        assert!(fills.iter().any(|(pos, _)| *pos == pos_a3), "A3 should have fill");
        assert!(!fills.iter().any(|(pos, _)| *pos == pos_a2), "A2 should NOT have fill");
    }
}
