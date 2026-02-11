//! Conditional format evaluation for rendering.

use uuid::Uuid;

use crate::{
    CellValue, Pos, Rect, RefAdjust, SheetPos, Value,
    a1::{A1Context, A1Selection, CellRefRange},
    color::contrasting_text_color_hex,
    controller::GridController,
    formulas::{Ctx, adjust_references, ast::Formula, parse_formula},
    grid::{
        Contiguous2D, SheetId,
        js_types::JsRenderCell,
        sheet::conditional_format::{
            ColorScale, ColorScaleThresholdValueType, ConditionalFormat, ConditionalFormatConfig,
            ConditionalFormatStyle, color_scale::compute_color_for_value,
        },
    },
    values::IsBlank,
};

use crate::grid::sheet::merge_cells::MergeCells;

use super::rules::ConditionalFormatRule;

/// For conditional formatting, merged cells are treated as one cell: use the
/// merge's anchor position for rule evaluation so the result applies to the whole merge.
fn effective_cf_pos(merge_cells: &MergeCells, pos: Pos) -> Pos {
    merge_cells
        .get_merge_cell_rect(pos)
        .map(|r| r.min)
        .unwrap_or(pos)
}

impl GridController {
    /// Checks if a cell is blank.
    fn is_cell_blank(&self, sheet_pos: SheetPos) -> bool {
        if let Some(sheet) = self.try_sheet(sheet_pos.sheet_id) {
            let pos = Pos {
                x: sheet_pos.x,
                y: sheet_pos.y,
            };
            let value = sheet.get_cell_for_formula(pos);
            value.is_blank()
        } else {
            true
        }
    }

    /// Returns the formula anchor: the top-left of the first range (min col, min row).
    /// For denormalized ranges (e.g. B1:A10) this is A1, so "=A1>5" is interpreted consistently.
    fn formula_anchor_from_selection(
        selection: &A1Selection,
        a1_context: &A1Context,
    ) -> Option<Pos> {
        selection.ranges.first().and_then(|range| match range {
            CellRefRange::Sheet { range } => {
                let x = range.start.col().min(range.end.col());
                let y = range.start.row().min(range.end.row());
                if x != crate::a1::UNBOUNDED && y != crate::a1::UNBOUNDED {
                    Some(Pos { x, y })
                } else {
                    None
                }
            }
            CellRefRange::Table { .. } => {
                ConditionalFormatRule::get_first_cell_from_selection(selection, a1_context)
            }
        })
    }

    /// Evaluates a formula-based conditional format rule at a specific cell position.
    /// Translates the formula references relative to the anchor (top-left of first range).
    fn evaluate_formula_rule(
        &self,
        formula: &Formula,
        selection: &crate::a1::A1Selection,
        sheet_pos: SheetPos,
        a1_context: &A1Context,
    ) -> bool {
        let anchor = Self::formula_anchor_from_selection(selection, a1_context)
            .or_else(|| ConditionalFormatRule::get_first_cell_from_selection(selection, a1_context))
            .unwrap_or(selection.cursor);

        // Calculate offset from anchor to current position
        let dx = sheet_pos.x - anchor.x;
        let dy = sheet_pos.y - anchor.y;

        // If no translation needed, evaluate directly
        if dx == 0 && dy == 0 {
            let mut ctx = Ctx::new_for_conditional_format(self, sheet_pos);
            let result = formula.eval(&mut ctx);
            return is_truthy(&result.inner);
        }

        // Get the original formula string from the AST
        let formula_string = formula.to_a1_string(Some(sheet_pos.sheet_id), a1_context);

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
        let adjusted_formula = adjust_references(
            &formula_string,
            sheet_pos.sheet_id,
            a1_context,
            anchor_pos,
            adjust,
        );

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

    /// Evaluates a conditional format at a specific cell position.
    /// For formula-based formats, returns true if the formula is truthy.
    /// For color scales, always returns true (color is computed separately).
    fn evaluate_conditional_format_rule(
        &self,
        cf: &ConditionalFormat,
        sheet_pos: SheetPos,
        a1_context: &A1Context,
    ) -> bool {
        // Check if the cell is blank and whether we should skip blank cells
        let should_apply_to_blank = cf.should_apply_to_blank(sheet_pos.sheet_id, a1_context);
        if !should_apply_to_blank && self.is_cell_blank(sheet_pos) {
            return false;
        }

        match &cf.config {
            ConditionalFormatConfig::Formula { rule, .. } => {
                self.evaluate_formula_rule(rule, &cf.selection, sheet_pos, a1_context)
            }
            ConditionalFormatConfig::ColorScale { .. } => {
                // Color scales always apply (the actual color is computed separately)
                true
            }
        }
    }

    /// Get the numeric value of a cell, returning None if not numeric.
    fn get_cell_numeric_value(&self, sheet_pos: SheetPos) -> Option<f64> {
        let sheet = self.try_sheet(sheet_pos.sheet_id)?;
        let pos = Pos {
            x: sheet_pos.x,
            y: sheet_pos.y,
        };
        let value = sheet.get_cell_for_formula(pos);
        match value {
            CellValue::Number(n) => n.try_into().ok(),
            _ => None,
        }
    }

    /// Collect all numeric values in a selection for computing min/max/percentiles.
    /// For unbounded selections (like entire columns), uses the sheet's data bounds.
    fn collect_numeric_values(
        &self,
        sheet_id: SheetId,
        selection: &crate::a1::A1Selection,
        a1_context: &A1Context,
    ) -> Vec<f64> {
        use crate::grid::GridBounds;

        let Some(sheet) = self.try_sheet(sheet_id) else {
            return vec![];
        };

        let mut values = Vec::new();

        // Get the rect to iterate over. For unbounded selections, use the sheet's data bounds.
        let finite_rect = selection.largest_rect_finite(a1_context);

        // Check if the selection might be unbounded by seeing if any range is unbounded
        let has_unbounded = selection.ranges.iter().any(|range| match range {
            crate::a1::CellRefRange::Sheet { range } => range.end.is_unbounded(),
            crate::a1::CellRefRange::Table { .. } => false,
        });

        let rect = if has_unbounded {
            // Use the sheet's data bounds (ignore formatting, only data)
            match sheet.bounds(true) {
                GridBounds::NonEmpty(data_rect) => {
                    // Union with the finite rect in case the cursor is outside data bounds
                    data_rect.union(&finite_rect)
                }
                GridBounds::Empty => finite_rect,
            }
        } else {
            finite_rect
        };

        for y in rect.y_range() {
            for x in rect.x_range() {
                let pos = Pos { x, y };
                if selection.contains_pos(pos, a1_context) {
                    let value = sheet.get_cell_for_formula(pos);
                    if let CellValue::Number(n) = value
                        && let Ok(f) = n.try_into()
                    {
                        values.push(f);
                    }
                }
            }
        }

        values.sort_by(|a: &f64, b: &f64| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        values
    }

    /// Compute the threshold values for a color scale based on the values in the selection.
    fn compute_color_scale_threshold_values(
        &self,
        color_scale: &ColorScale,
        sheet_id: SheetId,
        selection: &crate::a1::A1Selection,
        a1_context: &A1Context,
    ) -> Vec<f64> {
        let values = self.collect_numeric_values(sheet_id, selection, a1_context);

        if values.is_empty() {
            // No values, return zeros as placeholder
            return color_scale.thresholds.iter().map(|_| 0.0).collect();
        }

        let min_val = *values.first().unwrap();
        let max_val = *values.last().unwrap();
        let range = max_val - min_val;

        color_scale
            .thresholds
            .iter()
            .map(|threshold| {
                match &threshold.value_type {
                    ColorScaleThresholdValueType::Min => min_val,
                    ColorScaleThresholdValueType::Max => max_val,
                    ColorScaleThresholdValueType::Number(n) => *n,
                    ColorScaleThresholdValueType::Percentile(p) => {
                        // Compute the p-th percentile using linear interpolation
                        // (matches Excel's PERCENTILE.INC behavior)
                        if values.is_empty() {
                            0.0
                        } else {
                            let k = p / 100.0;
                            let n = values.len();
                            let pos = k * (n as f64 - 1.0);
                            let lower = pos.floor() as usize;
                            let frac = pos - lower as f64;
                            if lower + 1 >= n {
                                values[lower]
                            } else {
                                values[lower] + frac * (values[lower + 1] - values[lower])
                            }
                        }
                    }
                    ColorScaleThresholdValueType::Percent(p) => {
                        // Compute as min + range * percent/100
                        min_val + range * (p / 100.0)
                    }
                }
            })
            .collect()
    }

    /// Get or compute threshold values for a color scale, using the sheet's cache.
    /// The cache is keyed by format ID and stores the computed threshold values.
    /// Returns a clone of the threshold values to avoid holding the borrow across function calls.
    fn get_or_compute_threshold_values(
        &self,
        format_id: Uuid,
        color_scale: &ColorScale,
        sheet_id: SheetId,
        selection: &A1Selection,
        a1_context: &A1Context,
    ) -> Vec<f64> {
        let sheet = match self.try_sheet(sheet_id) {
            Some(s) => s,
            None => {
                return self.compute_color_scale_threshold_values(
                    color_scale,
                    sheet_id,
                    selection,
                    a1_context,
                );
            }
        };

        // Check if already cached
        if let Some(values) = sheet.color_scale_threshold_cache.borrow().get(&format_id) {
            return values.clone();
        }

        // Compute and cache the values
        let values =
            self.compute_color_scale_threshold_values(color_scale, sheet_id, selection, a1_context);
        sheet
            .color_scale_threshold_cache
            .borrow_mut()
            .insert(format_id, values.clone());
        values
    }

    /// Compute the color for a cell based on a color scale, using the sheet's cache for threshold values.
    /// This avoids recomputing threshold values for each cell in the selection (O(N²) -> O(N)).
    fn compute_color_scale_color_cached(
        &self,
        format_id: Uuid,
        color_scale: &ColorScale,
        sheet_id: SheetId,
        selection: &A1Selection,
        sheet_pos: SheetPos,
        a1_context: &A1Context,
    ) -> Option<String> {
        let cell_value = self.get_cell_numeric_value(sheet_pos)?;
        let threshold_values = self.get_or_compute_threshold_values(
            format_id,
            color_scale,
            sheet_id,
            selection,
            a1_context,
        );
        compute_color_for_value(color_scale, &threshold_values, cell_value)
    }

    /// Evaluates all conditional formats that apply to a cell and returns
    /// the combined style to apply. Later rules override earlier ones.
    /// Includes the preview format if one is set.
    pub fn get_conditional_format_style(
        &self,
        sheet_pos: SheetPos,
        a1_context: &A1Context,
    ) -> Option<ConditionalFormatStyle> {
        let sheet = self.try_sheet(sheet_pos.sheet_id)?;

        // Get all conditional formats that might apply to this cell
        let pos = Pos {
            x: sheet_pos.x,
            y: sheet_pos.y,
        };
        let effective_pos = effective_cf_pos(&sheet.merge_cells, pos);
        let effective_sheet_pos = effective_pos.to_sheet_pos(sheet_pos.sheet_id);

        // Get the preview format ID (if any) to exclude persisted formats with the same ID
        let preview_id = sheet.preview_conditional_format.as_ref().map(|p| p.id);

        // Collect formats, excluding any with the same ID as the preview
        // (the preview replaces the persisted format during editing)
        let mut formats: Vec<&ConditionalFormat> = sheet
            .conditional_formats
            .iter()
            .filter(|cf| cf.selection.contains_pos(pos, a1_context) && preview_id != Some(cf.id))
            .collect();

        // Add preview format if it applies to this cell
        if let Some(ref preview) = sheet.preview_conditional_format
            && preview.selection.contains_pos(pos, a1_context)
        {
            formats.push(preview);
        }

        if formats.is_empty() {
            return None;
        }

        let mut combined_style = ConditionalFormatStyle::default();
        let mut any_applied = false;

        for cf in formats {
            // Evaluate the formula with translated references (use effective pos for merged cells)
            if self.evaluate_conditional_format_rule(cf, effective_sheet_pos, a1_context) {
                // Apply the style (later rules override earlier ones)
                // Only formula-based formats have styles; color scales are handled separately
                if let Some(style) = cf.style() {
                    if style.bold.is_some() {
                        combined_style.bold = style.bold;
                    }
                    if style.italic.is_some() {
                        combined_style.italic = style.italic;
                    }
                    if style.underline.is_some() {
                        combined_style.underline = style.underline;
                    }
                    if style.strike_through.is_some() {
                        combined_style.strike_through = style.strike_through;
                    }
                    if style.text_color.is_some() {
                        combined_style.text_color = style.text_color.clone();
                    }
                    if style.fill_color.is_some() {
                        combined_style.fill_color = style.fill_color.clone();
                    }
                    any_applied = true;
                }
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
    /// Includes the preview format if one is set.
    pub fn apply_conditional_formatting_to_cells(
        &self,
        sheet_id: SheetId,
        rect: Rect,
        cells: &mut [JsRenderCell],
    ) {
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return;
        };

        // Skip if no conditional formats and no preview
        if sheet.conditional_formats.is_empty() && sheet.preview_conditional_format.is_none() {
            return;
        }

        let a1_context = self.a1_context();

        // Get the preview format ID (if any) to exclude persisted formats with the same ID
        let preview_id = sheet.preview_conditional_format.as_ref().map(|p| p.id);

        // Pre-filter conditional formats to only those that overlap the rect
        // and have non-fill styles (fill_color is handled separately)
        // Exclude formats with the same ID as the preview
        let mut overlapping_formats: Vec<&ConditionalFormat> = sheet
            .conditional_formats
            .iter()
            .filter(|cf| {
                cf.has_non_fill_style()
                    && cf.selection.intersects_rect(rect, a1_context)
                    && preview_id != Some(cf.id)
            })
            .collect();

        // Add preview format if it has non-fill styles and overlaps the rect
        if let Some(ref preview) = sheet.preview_conditional_format
            && preview.has_non_fill_style()
            && preview.selection.intersects_rect(rect, a1_context)
        {
            overlapping_formats.push(preview);
        }

        if overlapping_formats.is_empty() {
            return;
        }

        for cell in cells.iter_mut() {
            let pos = Pos {
                x: cell.x,
                y: cell.y,
            };
            let effective_pos = effective_cf_pos(&sheet.merge_cells, pos);
            let effective_sheet_pos = effective_pos.to_sheet_pos(sheet_id);

            // Only check the pre-filtered formats
            let mut combined_style = ConditionalFormatStyle::default();
            let mut any_applied = false;

            for cf in &overlapping_formats {
                if cf.selection.contains_pos(pos, a1_context)
                    && self.evaluate_conditional_format_rule(cf, effective_sheet_pos, a1_context)
                {
                    // Handle formula-based formats with explicit styles
                    if let Some(style) = cf.style() {
                        if style.bold.is_some() {
                            combined_style.bold = style.bold;
                        }
                        if style.italic.is_some() {
                            combined_style.italic = style.italic;
                        }
                        if style.underline.is_some() {
                            combined_style.underline = style.underline;
                        }
                        if style.strike_through.is_some() {
                            combined_style.strike_through = style.strike_through;
                        }
                        if style.text_color.is_some() {
                            combined_style.text_color = style.text_color.clone();
                        }
                        any_applied = true;
                    }

                    // Handle color scales with invert_text_on_dark
                    // Uses sheet-level cache to avoid recomputing thresholds for each cell
                    if let Some(color_scale) = cf.color_scale()
                        && color_scale.invert_text_on_dark
                        && let Some(fill_color) = self.compute_color_scale_color_cached(
                            cf.id,
                            color_scale,
                            sheet_id,
                            &cf.selection,
                            effective_sheet_pos,
                            a1_context,
                        )
                        && let Some(text_color) = contrasting_text_color_hex(&fill_color)
                    {
                        combined_style.text_color = Some(text_color);
                        any_applied = true;
                    }
                }
            }

            if any_applied {
                if let Some(bold) = combined_style.bold {
                    cell.bold = Some(bold);
                }
                if let Some(italic) = combined_style.italic {
                    cell.italic = Some(italic);
                }
                if let Some(underline) = combined_style.underline {
                    cell.underline = Some(underline);
                }
                if let Some(strike_through) = combined_style.strike_through {
                    cell.strike_through = Some(strike_through);
                }
                if let Some(text_color) = combined_style.text_color {
                    cell.text_color = Some(text_color);
                }
            }
        }
    }

    /// Gets all conditional format fills for cells within a rect.
    /// Returns a list of (rect, fill_color) tuples for cells where conditional
    /// formatting applies and has a fill color. Uses Contiguous2D to efficiently
    /// combine adjacent cells with the same fill color into rectangles.
    /// Includes the preview format if one is set.
    pub fn get_conditional_format_fills(
        &self,
        sheet_id: SheetId,
        rect: Rect,
        a1_context: &A1Context,
    ) -> Vec<(Rect, String)> {
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return vec![];
        };

        // Get the preview format ID (if any) to exclude persisted formats with the same ID
        let preview_id = sheet.preview_conditional_format.as_ref().map(|p| p.id);

        // Pre-filter conditional formats to only those that have fills
        // (either static fill_color or color scale) and overlap the rect.
        // Exclude formats with the same ID as the preview.
        let mut formats_with_fills: Vec<&ConditionalFormat> = sheet
            .conditional_formats
            .iter()
            .filter(|cf| {
                cf.has_fill()
                    && cf.selection.intersects_rect(rect, a1_context)
                    && preview_id != Some(cf.id)
            })
            .collect();

        // Add preview format if it has a fill and overlaps the rect
        if let Some(ref preview) = sheet.preview_conditional_format
            && preview.has_fill()
            && preview.selection.intersects_rect(rect, a1_context)
        {
            formats_with_fills.push(preview);
        }

        if formats_with_fills.is_empty() {
            return vec![];
        }

        // Use Contiguous2D to store fill colors - later rules override earlier ones
        let mut fills: Contiguous2D<String> = Contiguous2D::new();

        for y in rect.y_range() {
            for x in rect.x_range() {
                let pos = Pos { x, y };
                let effective_pos = effective_cf_pos(&sheet.merge_cells, pos);
                let effective_sheet_pos = effective_pos.to_sheet_pos(sheet_id);

                // Check each format with a fill (in order, first to last)
                for cf in &formats_with_fills {
                    if cf.selection.contains_pos(pos, a1_context) {
                        // Evaluate the conditional format (use effective pos for merged cells)
                        if self.evaluate_conditional_format_rule(
                            cf,
                            effective_sheet_pos,
                            a1_context,
                        ) {
                            // Get the fill color based on format type
                            let fill_color = match &cf.config {
                                ConditionalFormatConfig::Formula { style, .. } => {
                                    style.fill_color.clone()
                                }
                                ConditionalFormatConfig::ColorScale { color_scale } => {
                                    // Compute the interpolated color based on cell value
                                    // Uses sheet-level cache to avoid recomputing thresholds for each cell
                                    self.compute_color_scale_color_cached(
                                        cf.id,
                                        color_scale,
                                        sheet_id,
                                        &cf.selection,
                                        effective_sheet_pos,
                                        a1_context,
                                    )
                                }
                            };

                            if let Some(color) = fill_color {
                                // Later rules override earlier ones
                                fills.set(pos, color);
                            }
                        }
                    }
                }
            }
        }

        // Use nondefault_rects_in_rect to get combined rectangles with colors
        fills.nondefault_rects_in_rect(rect).collect()
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
        CellValue::Code(code_cell) => is_cell_value_truthy(&code_cell.output),
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
        grid::{
            sheet::conditional_format::{
                ConditionalFormat, ConditionalFormatRule, ConditionalFormatStyle,
            },
            sort::SortDirection,
        },
        test_util::*,
    };
    use uuid::Uuid;

    fn create_test_conditional_format(
        gc: &GridController,
        selection: &str,
        formula: &str,
        style: ConditionalFormatStyle,
    ) -> ConditionalFormat {
        create_test_conditional_format_with_apply_to_blank(gc, selection, formula, style, None)
    }

    fn create_test_conditional_format_with_apply_to_blank(
        gc: &GridController,
        selection: &str,
        formula: &str,
        style: ConditionalFormatStyle,
        apply_to_blank: Option<bool>,
    ) -> ConditionalFormat {
        let sheet_id = gc.sheet_ids()[0];
        // Use test_a1_sheet_id to create selection with the correct sheet_id
        let a1_selection = A1Selection::test_a1_sheet_id(selection, sheet_id);
        let pos = a1_selection.cursor.to_sheet_pos(sheet_id);
        let rule = parse_formula(formula, gc.a1_context(), pos).unwrap();

        ConditionalFormat {
            id: Uuid::new_v4(),
            selection: a1_selection,
            config: ConditionalFormatConfig::Formula { rule, style },
            apply_to_blank,
        }
    }

    /// Creates a conditional format with a table column reference selection
    /// (e.g., "test_table[Column 1]"). Uses a1_context for parsing table refs.
    fn create_test_conditional_format_table_ref(
        gc: &GridController,
        selection: &str,
        formula: &str,
        style: ConditionalFormatStyle,
    ) -> ConditionalFormat {
        let sheet_id = gc.sheet_ids()[0];
        let a1_context = gc.a1_context();
        let a1_selection =
            A1Selection::parse(selection, sheet_id, a1_context, None).expect("parse table ref");
        let anchor =
            ConditionalFormatRule::get_first_cell_from_selection(&a1_selection, a1_context)
                .unwrap_or(a1_selection.cursor);
        let pos = anchor.to_sheet_pos(sheet_id);
        let rule = parse_formula(formula, a1_context, pos).unwrap();

        ConditionalFormat {
            id: Uuid::new_v4(),
            selection: a1_selection,
            config: ConditionalFormatConfig::Formula { rule, style },
            apply_to_blank: None,
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
        gc.sheet_mut(sheet_id)
            .conditional_formats
            .set(cf.clone(), sheet_id);

        // Test that the style is applied
        let sheet_pos = pos_a1.to_sheet_pos(sheet_id);

        // Debug: check if selection contains the position
        let a1_context = gc.a1_context();
        let contains = cf.selection.contains_pos(pos_a1, a1_context);
        assert!(contains, "Selection should contain A1");

        let style = gc.get_conditional_format_style(sheet_pos, gc.a1_context());

        assert!(
            style.is_some(),
            "Style should be Some because formula is TRUE"
        );
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
        gc.apply_conditional_formatting_to_cells(sheet_id, rect, &mut cells);

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
        assert!(fills[0].0.contains(pos_a1));
        assert_eq!(fills[0].1, "green".to_string());
    }

    /// Conditional formatting should treat a merged cell as one cell: the rule is
    /// evaluated once using the merge's anchor value, and the result applies to the
    /// entire merged area. Without this, only the anchor cell gets the format.
    #[test]
    fn test_conditional_format_merged_cell_treated_as_one() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");
        let pos_b1 = crate::Pos::test_a1("B1");

        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "10".to_string(), None, false);
        gc.merge_cells(
            A1Selection::test_a1_sheet_id("A1:B1", sheet_id),
            None,
            false,
        );

        let cf = create_test_conditional_format(
            &gc,
            "A1:B1",
            "=A1>5",
            ConditionalFormatStyle {
                fill_color: Some("red".to_string()),
                ..Default::default()
            },
        );
        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        let rect = Rect::new_span(pos_a1, pos_b1);
        let fills = gc.get_conditional_format_fills(sheet_id, rect, gc.a1_context());

        let any_rect_contains = |pos: crate::Pos| fills.iter().any(|(r, _)| r.contains(pos));
        assert!(
            any_rect_contains(pos_a1),
            "Conditional format fill should cover anchor A1"
        );
        assert!(
            any_rect_contains(pos_b1),
            "Conditional format fill should cover B1 (merged with A1); entire merge must be treated as one cell"
        );
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
        let style_a1 =
            gc.get_conditional_format_style(pos_a1.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(style_a1.is_some(), "A1 (10>5) should have style applied");

        // A2: =A2>5 -> 3>5 -> false (should NOT apply)
        let style_a2 =
            gc.get_conditional_format_style(pos_a2.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(style_a2.is_none(), "A2 (3>5) should NOT have style applied");

        // A3: =A3>5 -> 7>5 -> true (should apply)
        let style_a3 =
            gc.get_conditional_format_style(pos_a3.to_sheet_pos(sheet_id), gc.a1_context());
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
        let style_a1 =
            gc.get_conditional_format_style(pos_a1.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(
            style_a1.is_some(),
            "A1 ($A$1>5 = 10>5) should have style applied"
        );

        // A2 should also check $A$1>5 (absolute ref), not $A$2>5
        let style_a2 =
            gc.get_conditional_format_style(pos_a2.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(
            style_a2.is_some(),
            "A2 ($A$1>5 = 10>5, absolute ref) should have style applied"
        );
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
        assert!(
            fills.iter().any(|(rect, _)| rect.contains(pos_a1)),
            "A1 should have fill"
        );
        assert!(
            fills.iter().any(|(rect, _)| rect.contains(pos_a3)),
            "A3 should have fill"
        );
        assert!(
            !fills.iter().any(|(rect, _)| rect.contains(pos_a2)),
            "A2 should NOT have fill"
        );
    }

    #[test]
    fn test_conditional_format_denormalized_range() {
        // Conditional format with denormalized range B1:A10 (same rect as A1:B10).
        // Formula translation anchor is B1 (first range start), so at A1 we evaluate A1>5.
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");
        let pos_a2 = crate::Pos::test_a1("A2");
        let pos_b1 = crate::Pos::test_a1("B1");
        let pos_b2 = crate::Pos::test_a1("B2");
        let pos_c1 = crate::Pos::test_a1("C1");

        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "10".to_string(), None, false);
        gc.set_cell_value(pos_a2.to_sheet_pos(sheet_id), "3".to_string(), None, false);
        gc.set_cell_value(pos_b1.to_sheet_pos(sheet_id), "8".to_string(), None, false);
        gc.set_cell_value(pos_b2.to_sheet_pos(sheet_id), "2".to_string(), None, false);
        gc.set_cell_value(pos_c1.to_sheet_pos(sheet_id), "99".to_string(), None, false);

        let cf = create_test_conditional_format(
            &gc,
            "B1:A10",
            "=A1>5",
            ConditionalFormatStyle {
                bold: Some(true),
                ..Default::default()
            },
        );

        let a1_context = gc.a1_context();
        assert!(
            cf.selection.contains_pos(pos_a1, a1_context),
            "Selection B1:A10 should contain A1 (denormalized range)"
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // Cells inside the rect (A1:B10) with value >5 should have style
        let style_a1 =
            gc.get_conditional_format_style(pos_a1.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(style_a1.is_some(), "A1 (10>5) inside B1:A10 should have style");

        let style_b1 =
            gc.get_conditional_format_style(pos_b1.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(style_b1.is_some(), "B1 (8>5) inside B1:A10 should have style");

        // Cells inside the rect with value <=5 should not have style
        let style_a2 =
            gc.get_conditional_format_style(pos_a2.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(style_a2.is_none(), "A2 (3>5 false) should not have style");

        let style_b2 =
            gc.get_conditional_format_style(pos_b2.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(style_b2.is_none(), "B2 (2>5 false) should not have style");

        // Cell outside the range (C1) should not have style even if value >5
        let style_c1 =
            gc.get_conditional_format_style(pos_c1.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(style_c1.is_none(), "C1 is outside B1:A10, should not have style");
    }

    #[test]
    fn test_conditional_format_multiple_ranges_share_anchor() {
        // Test that when a conditional format has multiple ranges, they all share
        // the same anchor (first range's top-left) for formula translation.
        // Example: selection="A1:A3, C1:C3", formula=A1>5
        // - At A1: evaluates A1>5 (offset 0,0 from anchor A1)
        // - At A2: evaluates A2>5 (offset 0,1 from anchor A1)
        // - At C1: evaluates C1>5 (offset 2,0 from anchor A1)
        // - At C2: evaluates C2>5 (offset 2,1 from anchor A1)
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");
        let pos_a2 = crate::Pos::test_a1("A2");
        let pos_c1 = crate::Pos::test_a1("C1");
        let pos_c2 = crate::Pos::test_a1("C2");

        // Set values: A1=10 (>5), A2=3 (<5), C1=8 (>5), C2=2 (<5)
        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "10".to_string(), None, false);
        gc.set_cell_value(pos_a2.to_sheet_pos(sheet_id), "3".to_string(), None, false);
        gc.set_cell_value(pos_c1.to_sheet_pos(sheet_id), "8".to_string(), None, false);
        gc.set_cell_value(pos_c2.to_sheet_pos(sheet_id), "2".to_string(), None, false);

        // Create a conditional format for A1:A2, C1:C2 with formula =A1>5
        // The anchor is A1 (first range's top-left), so:
        // - At C1: formula translates to C1>5 (offset 2,0)
        // - At C2: formula translates to C2>5 (offset 2,1)
        let cf = create_test_conditional_format(
            &gc,
            "A1:A2, C1:C2",
            "=A1>5",
            ConditionalFormatStyle {
                bold: Some(true),
                ..Default::default()
            },
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // A1: =A1>5 -> 10>5 -> true
        let style_a1 =
            gc.get_conditional_format_style(pos_a1.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(style_a1.is_some(), "A1 (10>5) should have style applied");

        // A2: =A2>5 -> 3>5 -> false
        let style_a2 =
            gc.get_conditional_format_style(pos_a2.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(style_a2.is_none(), "A2 (3>5) should NOT have style applied");

        // C1: =C1>5 -> 8>5 -> true (formula translated from A1>5 using offset 2,0)
        let style_c1 =
            gc.get_conditional_format_style(pos_c1.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(
            style_c1.is_some(),
            "C1 (8>5, translated from A1>5) should have style applied"
        );

        // C2: =C2>5 -> 2>5 -> false (formula translated from A1>5 using offset 2,1)
        let style_c2 =
            gc.get_conditional_format_style(pos_c2.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(
            style_c2.is_none(),
            "C2 (2>5, translated from A1>5) should NOT have style applied"
        );
    }

    #[test]
    fn test_conditional_format_fills_multiple_ranges() {
        // Test that get_conditional_format_fills works correctly with multiple ranges
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");
        let pos_a2 = crate::Pos::test_a1("A2");
        let pos_c1 = crate::Pos::test_a1("C1");
        let pos_c2 = crate::Pos::test_a1("C2");

        // Set values: A1=10 (>5), A2=3 (<5), C1=8 (>5), C2=2 (<5)
        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "10".to_string(), None, false);
        gc.set_cell_value(pos_a2.to_sheet_pos(sheet_id), "3".to_string(), None, false);
        gc.set_cell_value(pos_c1.to_sheet_pos(sheet_id), "8".to_string(), None, false);
        gc.set_cell_value(pos_c2.to_sheet_pos(sheet_id), "2".to_string(), None, false);

        // Create a conditional format for A1:A2, C1:C2 with formula =A1>5
        let cf = create_test_conditional_format(
            &gc,
            "A1:A2, C1:C2",
            "=A1>5",
            ConditionalFormatStyle {
                fill_color: Some("green".to_string()),
                ..Default::default()
            },
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // Get fills for the entire area A1:C2
        let fills = gc.get_conditional_format_fills(
            sheet_id,
            Rect::new_span(pos_a1, pos_c2),
            gc.a1_context(),
        );

        // Should have fills for A1 and C1 (values > 5), but not A2 or C2
        assert_eq!(fills.len(), 2, "Should have 2 fills (A1 and C1)");
        assert!(
            fills.iter().any(|(rect, _)| rect.contains(pos_a1)),
            "A1 should have fill"
        );
        assert!(
            fills.iter().any(|(rect, _)| rect.contains(pos_c1)),
            "C1 should have fill"
        );
        assert!(
            !fills.iter().any(|(rect, _)| rect.contains(pos_a2)),
            "A2 should NOT have fill"
        );
        assert!(
            !fills.iter().any(|(rect, _)| rect.contains(pos_c2)),
            "C2 should NOT have fill"
        );
    }

    #[test]
    fn test_blank_cell_skipped_for_numeric_comparison() {
        // Test that blank cells are skipped for numeric comparisons by default
        // (since blank coerces to 0, which would unexpectedly match >=0)
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");
        let pos_a2 = crate::Pos::test_a1("A2");

        // A1 is left blank, A2 has value 5
        gc.set_cell_value(pos_a2.to_sheet_pos(sheet_id), "5".to_string(), None, false);

        // Create a conditional format for A1:A2 with formula =A1>=0
        // Without the blank cell check, A1 would match because blank coerces to 0
        let cf = create_test_conditional_format(
            &gc,
            "A1:A2",
            "=A1>=0",
            ConditionalFormatStyle {
                bold: Some(true),
                ..Default::default()
            },
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // A1 is blank - should NOT get style because apply_to_blank defaults to false for numeric comparisons
        let style_a1 =
            gc.get_conditional_format_style(pos_a1.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(
            style_a1.is_none(),
            "A1 (blank) should NOT have style applied for numeric comparison"
        );

        // A2 has value 5 >= 0 - should get style
        let style_a2 =
            gc.get_conditional_format_style(pos_a2.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(style_a2.is_some(), "A2 (5>=0) should have style applied");
    }

    #[test]
    fn test_blank_cell_included_when_apply_to_blank_true() {
        // Test that blank cells are included when apply_to_blank is explicitly set to true
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");

        // A1 is left blank

        // Create a conditional format with apply_to_blank = true
        let cf = create_test_conditional_format_with_apply_to_blank(
            &gc,
            "A1",
            "=A1>=0",
            ConditionalFormatStyle {
                bold: Some(true),
                ..Default::default()
            },
            Some(true), // explicitly allow blank cells
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // A1 is blank but apply_to_blank is true, so it should be evaluated
        // blank coerces to 0, and 0 >= 0 is true
        let style_a1 =
            gc.get_conditional_format_style(pos_a1.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(
            style_a1.is_some(),
            "A1 (blank with apply_to_blank=true) should have style applied"
        );
    }

    #[test]
    fn test_isblank_includes_blank_cells_by_default() {
        // Test that ISBLANK rule includes blank cells by default
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");

        // A1 is left blank

        // Create a conditional format with ISBLANK formula
        let cf = create_test_conditional_format(
            &gc,
            "A1",
            "=ISBLANK(A1)",
            ConditionalFormatStyle {
                bold: Some(true),
                ..Default::default()
            },
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // A1 is blank - should get style because IsEmpty defaults apply_to_blank to true
        let style_a1 =
            gc.get_conditional_format_style(pos_a1.to_sheet_pos(sheet_id), gc.a1_context());
        assert!(
            style_a1.is_some(),
            "A1 (blank with ISBLANK) should have style applied"
        );
    }

    #[test]
    fn test_default_apply_to_blank_for_different_rule_types() {
        // Test that different rule types have correct default apply_to_blank values
        use super::super::rules::ConditionalFormatRule;

        // IsEmpty and IsNotEmpty should default to true
        assert!(
            ConditionalFormatRule::IsEmpty.default_apply_to_blank(),
            "IsEmpty should default to apply_to_blank=true"
        );
        assert!(
            ConditionalFormatRule::IsNotEmpty.default_apply_to_blank(),
            "IsNotEmpty should default to apply_to_blank=true"
        );

        // Numeric comparisons should default to false
        assert!(
            !ConditionalFormatRule::GreaterThan {
                value: super::super::rules::ConditionalFormatValue::Number(0.0)
            }
            .default_apply_to_blank(),
            "GreaterThan should default to apply_to_blank=false"
        );
        assert!(
            !ConditionalFormatRule::GreaterThanOrEqual {
                value: super::super::rules::ConditionalFormatValue::Number(0.0)
            }
            .default_apply_to_blank(),
            "GreaterThanOrEqual should default to apply_to_blank=false"
        );

        // Text conditions should default to false
        assert!(
            !ConditionalFormatRule::TextContains {
                value: "test".to_string()
            }
            .default_apply_to_blank(),
            "TextContains should default to apply_to_blank=false"
        );

        // Custom should default to false
        assert!(
            !ConditionalFormatRule::Custom {
                formula: "=TRUE".to_string()
            }
            .default_apply_to_blank(),
            "Custom should default to apply_to_blank=false"
        );
    }

    #[test]
    fn test_color_scale_fills() {
        // Test that color scale fills compute correctly
        use crate::grid::sheet::conditional_format::{
            ColorScale, ColorScaleThreshold, ConditionalFormat, ConditionalFormatConfig,
        };

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");
        let pos_a2 = crate::Pos::test_a1("A2");
        let pos_a3 = crate::Pos::test_a1("A3");

        // Set values: A1=0 (min), A2=50 (mid), A3=100 (max)
        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "0".to_string(), None, false);
        gc.set_cell_value(pos_a2.to_sheet_pos(sheet_id), "50".to_string(), None, false);
        gc.set_cell_value(
            pos_a3.to_sheet_pos(sheet_id),
            "100".to_string(),
            None,
            false,
        );

        // Create a color scale format from red to green
        let cf = ConditionalFormat {
            id: uuid::Uuid::new_v4(),
            selection: crate::a1::A1Selection::test_a1("A1:A3"),
            config: ConditionalFormatConfig::ColorScale {
                color_scale: ColorScale {
                    thresholds: vec![
                        ColorScaleThreshold::min("#ff0000"),
                        ColorScaleThreshold::max("#00ff00"),
                    ],
                    invert_text_on_dark: false,
                },
            },
            apply_to_blank: None,
        };

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // Get fills for the entire range
        let fills = gc.get_conditional_format_fills(
            sheet_id,
            Rect::new_span(pos_a1, pos_a3),
            gc.a1_context(),
        );

        // Should have fills for all 3 cells
        assert!(!fills.is_empty(), "Should have at least 1 fill rect");

        // A1 (min) should be red
        let a1_fill = fills.iter().find(|(rect, _)| rect.contains(pos_a1));
        assert!(a1_fill.is_some(), "A1 should have a fill");
        assert_eq!(a1_fill.unwrap().1, "#ff0000", "A1 should be red (min)");

        // A3 (max) should be green
        let a3_fill = fills.iter().find(|(rect, _)| rect.contains(pos_a3));
        assert!(a3_fill.is_some(), "A3 should have a fill");
        assert_eq!(a3_fill.unwrap().1, "#00ff00", "A3 should be green (max)");

        // A2 (mid) should be somewhere in between
        let a2_fill = fills.iter().find(|(rect, _)| rect.contains(pos_a2));
        assert!(a2_fill.is_some(), "A2 should have a fill");
        // Middle should be some shade that's not pure red or green
        let a2_color = &a2_fill.unwrap().1;
        assert!(a2_color.starts_with('#'), "A2 color should be a hex color");
        assert_ne!(a2_color, "#ff0000", "A2 should not be pure red");
        assert_ne!(a2_color, "#00ff00", "A2 should not be pure green");
    }

    #[test]
    fn test_color_scale_ignores_blank_cells_for_min_max() {
        // Test that color scale min/max calculation ignores blank cells
        // When values 1-10 are in A1:A10 but selection is entire column A,
        // min should be 1 and max should be 10 (not affected by blank cells)
        use crate::grid::sheet::conditional_format::{
            ColorScale, ColorScaleThreshold, ConditionalFormat, ConditionalFormatConfig,
        };

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set values 1-10 in A1:A10
        for i in 1..=10 {
            let pos = crate::Pos { x: 1, y: i };
            gc.set_cell_value(pos.to_sheet_pos(sheet_id), i.to_string(), None, false);
        }

        let pos_a1 = crate::Pos::test_a1("A1"); // value = 1 (min)
        let pos_a10 = crate::Pos::test_a1("A10"); // value = 10 (max)
        let pos_a5 = crate::Pos::test_a1("A5"); // value = 5 (mid)

        // Create a color scale format for the entire column A
        let cf = ConditionalFormat {
            id: uuid::Uuid::new_v4(),
            selection: crate::a1::A1Selection::test_a1("A:A"),
            config: ConditionalFormatConfig::ColorScale {
                color_scale: ColorScale {
                    thresholds: vec![
                        ColorScaleThreshold::min("#ff0000"), // red for min
                        ColorScaleThreshold::max("#00ff00"), // green for max
                    ],
                    invert_text_on_dark: false,
                },
            },
            apply_to_blank: None,
        };

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // Get fills for A1:A20 (includes blank cells A11:A20)
        let fills = gc.get_conditional_format_fills(
            sheet_id,
            Rect::new_span(pos_a1, crate::Pos::test_a1("A20")),
            gc.a1_context(),
        );

        // A1 (value=1, should be min) should be red
        let a1_fill = fills.iter().find(|(rect, _)| rect.contains(pos_a1));
        assert!(a1_fill.is_some(), "A1 should have a fill");
        assert_eq!(
            a1_fill.unwrap().1,
            "#ff0000",
            "A1 (value=1) should be red (min). Blank cells should not affect min calculation."
        );

        // A10 (value=10, should be max) should be green
        let a10_fill = fills.iter().find(|(rect, _)| rect.contains(pos_a10));
        assert!(a10_fill.is_some(), "A10 should have a fill");
        assert_eq!(
            a10_fill.unwrap().1,
            "#00ff00",
            "A10 (value=10) should be green (max). Blank cells should not affect max calculation."
        );

        // A5 (value=5, should be ~mid) should be somewhere in between
        let a5_fill = fills.iter().find(|(rect, _)| rect.contains(pos_a5));
        assert!(a5_fill.is_some(), "A5 should have a fill");
        let a5_color = &a5_fill.unwrap().1;
        assert_ne!(a5_color, "#ff0000", "A5 should not be pure red");
        assert_ne!(a5_color, "#00ff00", "A5 should not be pure green");

        // Blank cells (A11:A20) should NOT have fills
        let pos_a15 = crate::Pos::test_a1("A15");
        let a15_fill = fills.iter().find(|(rect, _)| rect.contains(pos_a15));
        assert!(
            a15_fill.is_none(),
            "A15 (blank) should NOT have a fill - blank cells should be excluded"
        );
    }

    #[test]
    fn test_color_scale_percentile_uses_linear_interpolation() {
        // Test that percentile thresholds use linear interpolation (Excel's PERCENTILE.INC)
        // With values [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], the 50th percentile should be 5.5
        // (interpolated between index 4 (value=5) and index 5 (value=6))
        use crate::grid::sheet::conditional_format::{
            ColorScale, ColorScaleThreshold, ConditionalFormat, ConditionalFormatConfig,
        };

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set values 1-10 in A1:A10
        for i in 1..=10 {
            let pos = crate::Pos::test_a1(&format!("A{}", i));
            gc.set_cell_value(pos.to_sheet_pos(sheet_id), i.to_string(), None, false);
        }

        // Create a color scale with percentile thresholds
        let cf = ConditionalFormat {
            id: uuid::Uuid::new_v4(),
            selection: crate::a1::A1Selection::test_a1("A1:A10"),
            config: ConditionalFormatConfig::ColorScale {
                color_scale: ColorScale {
                    thresholds: vec![
                        ColorScaleThreshold::min("#ff0000"), // red at min (1)
                        ColorScaleThreshold::percentile(50.0, "#ffff00"), // yellow at 50th percentile
                        ColorScaleThreshold::max("#00ff00"),              // green at max (10)
                    ],
                    invert_text_on_dark: false,
                },
            },
            apply_to_blank: None,
        };

        gc.sheet_mut(sheet_id)
            .conditional_formats
            .set(cf.clone(), sheet_id);

        // Get fills
        let pos_a1 = crate::Pos::test_a1("A1");
        let pos_a10 = crate::Pos::test_a1("A10");
        let rect = Rect::new_span(pos_a1, pos_a10);
        let fills = gc.get_conditional_format_fills(sheet_id, rect, gc.a1_context());

        // With linear interpolation (PERCENTILE.INC), for n=10 values:
        // pos = 0.5 * (10 - 1) = 4.5
        // So 50th percentile = values[4] + 0.5 * (values[5] - values[4]) = 5 + 0.5 * 1 = 5.5
        //
        // Therefore:
        // - Value 5 (A5) is below 50th percentile, should be red-yellow blend
        // - Value 6 (A6) is above 50th percentile, should be yellow-green blend

        let pos_a5 = crate::Pos::test_a1("A5");
        let pos_a6 = crate::Pos::test_a1("A6");

        let a5_fill = fills.iter().find(|(r, _)| r.contains(pos_a5));
        let a6_fill = fills.iter().find(|(r, _)| r.contains(pos_a6));

        assert!(a5_fill.is_some(), "A5 should have a fill");
        assert!(a6_fill.is_some(), "A6 should have a fill");

        // A5 (value=5) is in red-yellow segment, A6 (value=6) is in yellow-green segment
        // The colors should be different since they're on opposite sides of the 50th percentile
        let a5_color = &a5_fill.unwrap().1;
        let a6_color = &a6_fill.unwrap().1;

        assert_ne!(
            a5_color, a6_color,
            "A5 and A6 should have different colors (on opposite sides of 50th percentile)"
        );

        // A5 should have more red (it's in red-yellow segment)
        // A6 should have more green (it's in yellow-green segment)
        let (a5_r, _, a5_b) = crate::color::parse_hex_color(a5_color).unwrap();
        let (a6_r, _, a6_b) = crate::color::parse_hex_color(a6_color).unwrap();

        assert!(a5_r > a6_r, "A5 should have more red than A6");
        assert!(a5_b == 0 && a6_b == 0, "Both should have no blue component");
    }

    #[test]
    fn test_color_scale_cache_populated_on_evaluation() {
        // Test that the sheet-level cache is populated when color scale is evaluated
        use crate::grid::sheet::conditional_format::{
            ColorScale, ColorScaleThreshold, ConditionalFormat, ConditionalFormatConfig,
        };

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");
        let pos_a3 = crate::Pos::test_a1("A3");

        // Set values
        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "0".to_string(), None, false);
        gc.set_cell_value(
            crate::Pos::test_a1("A2").to_sheet_pos(sheet_id),
            "50".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            pos_a3.to_sheet_pos(sheet_id),
            "100".to_string(),
            None,
            false,
        );

        // Create a color scale format
        let format_id = uuid::Uuid::new_v4();
        let cf = ConditionalFormat {
            id: format_id,
            selection: crate::a1::A1Selection::test_a1("A1:A3"),
            config: ConditionalFormatConfig::ColorScale {
                color_scale: ColorScale {
                    thresholds: vec![
                        ColorScaleThreshold::min("#ff0000"),
                        ColorScaleThreshold::max("#00ff00"),
                    ],
                    invert_text_on_dark: false,
                },
            },
            apply_to_blank: None,
        };

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // Cache should be empty before evaluation
        assert!(
            gc.sheet(sheet_id)
                .color_scale_threshold_cache
                .borrow()
                .is_empty(),
            "Cache should be empty before evaluation"
        );

        // Evaluate fills (this should populate the cache)
        let _fills = gc.get_conditional_format_fills(
            sheet_id,
            Rect::new_span(pos_a1, pos_a3),
            gc.a1_context(),
        );

        // Cache should now contain the format's threshold values
        let cache = gc.sheet(sheet_id).color_scale_threshold_cache.borrow();
        assert!(
            cache.contains_key(&format_id),
            "Cache should contain the format ID after evaluation"
        );
        let cached_values = cache.get(&format_id).unwrap();
        assert_eq!(
            cached_values.len(),
            2,
            "Should have 2 threshold values (min, max)"
        );
        assert_eq!(cached_values[0], 0.0, "Min threshold should be 0");
        assert_eq!(cached_values[1], 100.0, "Max threshold should be 100");
    }

    #[test]
    fn test_color_scale_cache_cleared_on_transaction() {
        // Test that the cache is cleared when a transaction completes
        use crate::grid::sheet::conditional_format::{
            ColorScale, ColorScaleThreshold, ConditionalFormat, ConditionalFormatConfig,
        };

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");
        let pos_a3 = crate::Pos::test_a1("A3");

        // Set initial values
        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "0".to_string(), None, false);
        gc.set_cell_value(
            crate::Pos::test_a1("A2").to_sheet_pos(sheet_id),
            "50".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            pos_a3.to_sheet_pos(sheet_id),
            "100".to_string(),
            None,
            false,
        );

        // Create a color scale format
        let format_id = uuid::Uuid::new_v4();
        let cf = ConditionalFormat {
            id: format_id,
            selection: crate::a1::A1Selection::test_a1("A1:A3"),
            config: ConditionalFormatConfig::ColorScale {
                color_scale: ColorScale {
                    thresholds: vec![
                        ColorScaleThreshold::min("#ff0000"),
                        ColorScaleThreshold::max("#00ff00"),
                    ],
                    invert_text_on_dark: false,
                },
            },
            apply_to_blank: None,
        };

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // Evaluate fills to populate the cache
        let _fills = gc.get_conditional_format_fills(
            sheet_id,
            Rect::new_span(pos_a1, pos_a3),
            gc.a1_context(),
        );

        // Verify cache is populated
        assert!(
            !gc.sheet(sheet_id)
                .color_scale_threshold_cache
                .borrow()
                .is_empty(),
            "Cache should be populated after evaluation"
        );

        // Perform a transaction (changing a cell value)
        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "10".to_string(), None, false);

        // Cache should be cleared after the transaction
        assert!(
            gc.sheet(sheet_id)
                .color_scale_threshold_cache
                .borrow()
                .is_empty(),
            "Cache should be cleared after transaction"
        );
    }

    #[test]
    fn test_color_scale_cache_reused_across_calls() {
        // Test that cached values are reused when evaluating multiple cells
        use crate::grid::sheet::conditional_format::{
            ColorScale, ColorScaleThreshold, ConditionalFormat, ConditionalFormatConfig,
        };

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");
        let pos_a3 = crate::Pos::test_a1("A3");

        // Set values
        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "0".to_string(), None, false);
        gc.set_cell_value(
            crate::Pos::test_a1("A2").to_sheet_pos(sheet_id),
            "50".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            pos_a3.to_sheet_pos(sheet_id),
            "100".to_string(),
            None,
            false,
        );

        // Create a color scale format
        let format_id = uuid::Uuid::new_v4();
        let cf = ConditionalFormat {
            id: format_id,
            selection: crate::a1::A1Selection::test_a1("A1:A3"),
            config: ConditionalFormatConfig::ColorScale {
                color_scale: ColorScale {
                    thresholds: vec![
                        ColorScaleThreshold::min("#ff0000"),
                        ColorScaleThreshold::max("#00ff00"),
                    ],
                    invert_text_on_dark: false,
                },
            },
            apply_to_blank: None,
        };

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // First evaluation - should populate cache
        let fills1 = gc.get_conditional_format_fills(
            sheet_id,
            Rect::new_span(pos_a1, pos_a3),
            gc.a1_context(),
        );

        // Second evaluation - should use cached values
        let fills2 = gc.get_conditional_format_fills(
            sheet_id,
            Rect::new_span(pos_a1, pos_a3),
            gc.a1_context(),
        );

        // Results should be identical (same colors computed)
        assert_eq!(
            fills1.len(),
            fills2.len(),
            "Should have same number of fills"
        );
        for (fill1, fill2) in fills1.iter().zip(fills2.iter()) {
            assert_eq!(fill1.0, fill2.0, "Rects should match");
            assert_eq!(fill1.1, fill2.1, "Colors should match");
        }

        // Cache should still have the entry
        assert!(
            gc.sheet(sheet_id)
                .color_scale_threshold_cache
                .borrow()
                .contains_key(&format_id),
            "Cache should still contain the format ID"
        );
    }

    #[test]
    fn test_color_scale_cache_cleared_on_preview() {
        // Test that the cache is cleared when a preview conditional format is set or cleared
        use crate::grid::sheet::conditional_format::{
            ColorScale, ColorScaleThreshold, ConditionalFormat, ConditionalFormatConfig,
            ConditionalFormatConfigUpdate, ConditionalFormatStyle, ConditionalFormatUpdate,
        };

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos_a1 = crate::Pos::test_a1("A1");
        let pos_a3 = crate::Pos::test_a1("A3");

        // Set values
        gc.set_cell_value(pos_a1.to_sheet_pos(sheet_id), "0".to_string(), None, false);
        gc.set_cell_value(
            crate::Pos::test_a1("A2").to_sheet_pos(sheet_id),
            "50".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            pos_a3.to_sheet_pos(sheet_id),
            "100".to_string(),
            None,
            false,
        );

        // Create a color scale format
        let format_id = uuid::Uuid::new_v4();
        let cf = ConditionalFormat {
            id: format_id,
            selection: crate::a1::A1Selection::test_a1("A1:A3"),
            config: ConditionalFormatConfig::ColorScale {
                color_scale: ColorScale {
                    thresholds: vec![
                        ColorScaleThreshold::min("#ff0000"),
                        ColorScaleThreshold::max("#00ff00"),
                    ],
                    invert_text_on_dark: false,
                },
            },
            apply_to_blank: None,
        };

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        // Evaluate fills to populate the cache
        let _fills = gc.get_conditional_format_fills(
            sheet_id,
            Rect::new_span(pos_a1, pos_a3),
            gc.a1_context(),
        );

        // Verify cache is populated
        assert!(
            !gc.sheet(sheet_id)
                .color_scale_threshold_cache
                .borrow()
                .is_empty(),
            "Cache should be populated after evaluation"
        );

        // Set a preview conditional format (formula-based, not color scale)
        let preview_update = ConditionalFormatUpdate {
            sheet_id: sheet_id.to_string(),
            id: None,
            selection: "B1:B3".to_string(),
            config: ConditionalFormatConfigUpdate::Formula {
                rule: "=TRUE".to_string(),
                style: ConditionalFormatStyle {
                    bold: Some(true),
                    ..Default::default()
                },
            },
            apply_to_blank: None,
        };

        gc.set_preview_conditional_format(preview_update).unwrap();

        // Cache should be cleared after setting preview
        assert!(
            gc.sheet(sheet_id)
                .color_scale_threshold_cache
                .borrow()
                .is_empty(),
            "Cache should be cleared after setting preview"
        );

        // Evaluate fills again to repopulate the cache
        let _fills = gc.get_conditional_format_fills(
            sheet_id,
            Rect::new_span(pos_a1, pos_a3),
            gc.a1_context(),
        );

        // Verify cache is populated again
        assert!(
            !gc.sheet(sheet_id)
                .color_scale_threshold_cache
                .borrow()
                .is_empty(),
            "Cache should be populated after second evaluation"
        );

        // Clear the preview
        gc.clear_preview_conditional_format(sheet_id);

        // Cache should be cleared after clearing preview
        assert!(
            gc.sheet(sheet_id)
                .color_scale_threshold_cache
                .borrow()
                .is_empty(),
            "Cache should be cleared after clearing preview"
        );
    }

    #[test]
    fn test_conditional_format_with_sorted_table() {
        // Test that conditional formatting works correctly when a table is sorted.
        // The conditional format should apply to the displayed values, not the
        // original unsorted positions.

        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create a data table with numeric values for testing (no UI elements - no name/header rows)
        // Values: col1=numbers (100, 1000, 10000)
        // We'll sort and apply conditional format for values > 500
        let table_pos = pos![B2];

        // Create a simple 1-column, 3-row table with values 100, 1000, 10000
        test_create_data_table_no_ui(&mut gc, sheet_id, table_pos, 1, 3);

        // Now set actual values we want to test
        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y,
                sheet_id,
            },
            "100".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y + 1,
                sheet_id,
            },
            "1000".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y + 2,
                sheet_id,
            },
            "10000".to_string(),
            None,
            false,
        );

        // The table is now at B2:B4 (1 column, 3 rows, no header/name displayed)
        // B2=100, B3=1000, B4=10000

        // Create a conditional format for column B
        // Formula: highlight if value > 500 (should match 1000 and 10000, not 100)
        let cf = create_test_conditional_format(
            &gc,
            "B2:B4",
            "=B2>500", // Anchored at B2
            ConditionalFormatStyle {
                bold: Some(true),
                fill_color: Some("green".to_string()),
                ..Default::default()
            },
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        let data_row_1 = pos![B2]; // Value 100
        let data_row_2 = pos![B3]; // Value 1000
        let data_row_3 = pos![B4]; // Value 10000

        // Check values before sorting
        let sheet = gc.sheet(sheet_id);
        let val1 = sheet.display_value(data_row_1);
        let val2 = sheet.display_value(data_row_2);
        let val3 = sheet.display_value(data_row_3);

        // Verify original order: 100, 1000, 10000
        assert_eq!(
            val1.map(|v| v.to_display()),
            Some("100".to_string()),
            "First data row should be 100"
        );
        assert_eq!(
            val2.map(|v| v.to_display()),
            Some("1000".to_string()),
            "Second data row should be 1000"
        );
        assert_eq!(
            val3.map(|v| v.to_display()),
            Some("10000".to_string()),
            "Third data row should be 10000"
        );

        // Check conditional format styles before sorting
        let style1_before =
            gc.get_conditional_format_style(data_row_1.to_sheet_pos(sheet_id), gc.a1_context());
        let style2_before =
            gc.get_conditional_format_style(data_row_2.to_sheet_pos(sheet_id), gc.a1_context());
        let style3_before =
            gc.get_conditional_format_style(data_row_3.to_sheet_pos(sheet_id), gc.a1_context());

        assert!(
            style1_before.is_none(),
            "Row with value 100 should NOT have conditional format (before sort)"
        );
        assert!(
            style2_before.is_some(),
            "Row with value 1000 should have conditional format (before sort)"
        );
        assert!(
            style3_before.is_some(),
            "Row with value 10000 should have conditional format (before sort)"
        );

        // Now sort by column 0 descending (10000, 1000, 100)
        gc.sheet_mut(sheet_id)
            .modify_data_table_at(&table_pos, |dt| {
                dt.sort_column(0, SortDirection::Descending)?;
                Ok(())
            })
            .unwrap();

        // After sorting: display order should be 10000, 1000, 100
        let sheet = gc.sheet(sheet_id);
        let val1_sorted = sheet.display_value(data_row_1);
        let val2_sorted = sheet.display_value(data_row_2);
        let val3_sorted = sheet.display_value(data_row_3);

        // Verify sorted order: 10000, 1000, 100
        assert_eq!(
            val1_sorted.map(|v| v.to_display()),
            Some("10000".to_string()),
            "First data row after sort should be 10000"
        );
        assert_eq!(
            val2_sorted.map(|v| v.to_display()),
            Some("1000".to_string()),
            "Second data row after sort should be 1000"
        );
        assert_eq!(
            val3_sorted.map(|v| v.to_display()),
            Some("100".to_string()),
            "Third data row after sort should be 100"
        );

        // Check conditional format styles after sorting
        // The conditional format should follow the DISPLAYED values:
        // - data_row_1 displays 10000, should have style
        // - data_row_2 displays 1000, should have style
        // - data_row_3 displays 100, should NOT have style
        let style1_after =
            gc.get_conditional_format_style(data_row_1.to_sheet_pos(sheet_id), gc.a1_context());
        let style2_after =
            gc.get_conditional_format_style(data_row_2.to_sheet_pos(sheet_id), gc.a1_context());
        let style3_after =
            gc.get_conditional_format_style(data_row_3.to_sheet_pos(sheet_id), gc.a1_context());

        assert!(
            style1_after.is_some(),
            "After sort: Row displaying 10000 should have conditional format"
        );
        assert!(
            style2_after.is_some(),
            "After sort: Row displaying 1000 should have conditional format"
        );
        assert!(
            style3_after.is_none(),
            "After sort: Row displaying 100 should NOT have conditional format"
        );
    }

    #[test]
    fn test_conditional_format_updates_on_data_table_value_change() {
        // Test that conditional formatting is re-evaluated when a value changes within a data table.
        // This verifies that SetDataTableAt operations trigger check_conditional_format_fills.

        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create a data table with numeric values (no UI elements - no name/header rows)
        // Values: 100, 200, 300 (all below 500 threshold)
        let table_pos = pos![B2];
        test_create_data_table_no_ui(&mut gc, sheet_id, table_pos, 1, 3);

        // Set initial values: 100, 200, 300 (all below threshold)
        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y,
                sheet_id,
            },
            "100".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y + 1,
                sheet_id,
            },
            "200".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y + 2,
                sheet_id,
            },
            "300".to_string(),
            None,
            false,
        );

        // Create a conditional format: highlight if value > 500
        let cf = create_test_conditional_format(
            &gc,
            "B2:B4",
            "=B2>500",
            ConditionalFormatStyle {
                bold: Some(true),
                fill_color: Some("green".to_string()),
                ..Default::default()
            },
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        let cell_b2 = pos![B2];
        let cell_b3 = pos![B3];
        let cell_b4 = pos![B4];

        // Verify initial state: no cells should have conditional format (all values < 500)
        let style_b2_before =
            gc.get_conditional_format_style(cell_b2.to_sheet_pos(sheet_id), gc.a1_context());
        let style_b3_before =
            gc.get_conditional_format_style(cell_b3.to_sheet_pos(sheet_id), gc.a1_context());
        let style_b4_before =
            gc.get_conditional_format_style(cell_b4.to_sheet_pos(sheet_id), gc.a1_context());

        assert!(
            style_b2_before.is_none(),
            "B2 (value 100) should NOT have conditional format initially"
        );
        assert!(
            style_b3_before.is_none(),
            "B3 (value 200) should NOT have conditional format initially"
        );
        assert!(
            style_b4_before.is_none(),
            "B4 (value 300) should NOT have conditional format initially"
        );

        // Change B3 from 200 to 1000 (now > 500, should trigger conditional format)
        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y + 1,
                sheet_id,
            },
            "1000".to_string(),
            None,
            false,
        );

        // Verify that conditional formatting updated: B3 should now have the style
        let style_b2_after =
            gc.get_conditional_format_style(cell_b2.to_sheet_pos(sheet_id), gc.a1_context());
        let style_b3_after =
            gc.get_conditional_format_style(cell_b3.to_sheet_pos(sheet_id), gc.a1_context());
        let style_b4_after =
            gc.get_conditional_format_style(cell_b4.to_sheet_pos(sheet_id), gc.a1_context());

        assert!(
            style_b2_after.is_none(),
            "B2 (value 100) should still NOT have conditional format"
        );
        assert!(
            style_b3_after.is_some(),
            "B3 (value 1000) should now have conditional format after value change"
        );
        assert!(
            style_b4_after.is_none(),
            "B4 (value 300) should still NOT have conditional format"
        );

        // Change B3 back to 200 (now < 500, should remove conditional format)
        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y + 1,
                sheet_id,
            },
            "200".to_string(),
            None,
            false,
        );

        // Verify that conditional formatting removed from B3
        let style_b3_final =
            gc.get_conditional_format_style(cell_b3.to_sheet_pos(sheet_id), gc.a1_context());

        assert!(
            style_b3_final.is_none(),
            "B3 (value 200) should NOT have conditional format after changing back"
        );
    }

    #[test]
    fn test_conditional_format_updates_on_data_table_sort() {
        // Test that conditional formatting is re-evaluated when a data table is sorted.
        // This verifies that SortDataTable operations trigger check_conditional_format_fills.

        use crate::grid::data_table::sort::DataTableSort;

        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create a data table with numeric values (no UI elements)
        // Values: 100, 1000, 500
        let table_pos = pos![B2];
        test_create_data_table_no_ui(&mut gc, sheet_id, table_pos, 1, 3);

        // Set values: 100, 1000, 500
        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y,
                sheet_id,
            },
            "100".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y + 1,
                sheet_id,
            },
            "1000".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y + 2,
                sheet_id,
            },
            "500".to_string(),
            None,
            false,
        );

        // Create a conditional format: highlight if value > 500
        let cf = create_test_conditional_format(
            &gc,
            "B2:B4",
            "=B2>500",
            ConditionalFormatStyle {
                bold: Some(true),
                fill_color: Some("green".to_string()),
                ..Default::default()
            },
        );

        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        let cell_b2 = pos![B2];
        let cell_b3 = pos![B3];
        let cell_b4 = pos![B4];

        // Before sort: B2=100 (no style), B3=1000 (style), B4=500 (no style)
        let style_b2_before =
            gc.get_conditional_format_style(cell_b2.to_sheet_pos(sheet_id), gc.a1_context());
        let style_b3_before =
            gc.get_conditional_format_style(cell_b3.to_sheet_pos(sheet_id), gc.a1_context());
        let style_b4_before =
            gc.get_conditional_format_style(cell_b4.to_sheet_pos(sheet_id), gc.a1_context());

        assert!(
            style_b2_before.is_none(),
            "B2 (value 100) should NOT have conditional format before sort"
        );
        assert!(
            style_b3_before.is_some(),
            "B3 (value 1000) should have conditional format before sort"
        );
        assert!(
            style_b4_before.is_none(),
            "B4 (value 500) should NOT have conditional format before sort"
        );

        // Sort descending: display order becomes 1000, 500, 100
        gc.sort_data_table(
            table_pos.to_sheet_pos(sheet_id),
            Some(vec![DataTableSort {
                column_index: 0,
                direction: SortDirection::Descending,
            }]),
            None,
            false,
        );

        // After sort: B2 displays 1000 (style), B3 displays 500 (no style), B4 displays 100 (no style)
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(cell_b2).map(|v| v.to_display()),
            Some("1000".to_string()),
            "B2 should display 1000 after descending sort"
        );
        assert_eq!(
            sheet.display_value(cell_b3).map(|v| v.to_display()),
            Some("500".to_string()),
            "B3 should display 500 after descending sort"
        );
        assert_eq!(
            sheet.display_value(cell_b4).map(|v| v.to_display()),
            Some("100".to_string()),
            "B4 should display 100 after descending sort"
        );

        let style_b2_after =
            gc.get_conditional_format_style(cell_b2.to_sheet_pos(sheet_id), gc.a1_context());
        let style_b3_after =
            gc.get_conditional_format_style(cell_b3.to_sheet_pos(sheet_id), gc.a1_context());
        let style_b4_after =
            gc.get_conditional_format_style(cell_b4.to_sheet_pos(sheet_id), gc.a1_context());

        assert!(
            style_b2_after.is_some(),
            "B2 (displaying 1000) should have conditional format after sort"
        );
        assert!(
            style_b3_after.is_none(),
            "B3 (displaying 500) should NOT have conditional format after sort"
        );
        assert!(
            style_b4_after.is_none(),
            "B4 (displaying 100) should NOT have conditional format after sort"
        );

        // Sort ascending: display order becomes 100, 500, 1000
        gc.sort_data_table(
            table_pos.to_sheet_pos(sheet_id),
            Some(vec![DataTableSort {
                column_index: 0,
                direction: SortDirection::Ascending,
            }]),
            None,
            false,
        );

        // After ascending sort: B2 displays 100 (no style), B3 displays 500 (no style), B4 displays 1000 (style)
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(cell_b2).map(|v| v.to_display()),
            Some("100".to_string()),
            "B2 should display 100 after ascending sort"
        );
        assert_eq!(
            sheet.display_value(cell_b3).map(|v| v.to_display()),
            Some("500".to_string()),
            "B3 should display 500 after ascending sort"
        );
        assert_eq!(
            sheet.display_value(cell_b4).map(|v| v.to_display()),
            Some("1000".to_string()),
            "B4 should display 1000 after ascending sort"
        );

        let style_b2_ascending =
            gc.get_conditional_format_style(cell_b2.to_sheet_pos(sheet_id), gc.a1_context());
        let style_b3_ascending =
            gc.get_conditional_format_style(cell_b3.to_sheet_pos(sheet_id), gc.a1_context());
        let style_b4_ascending =
            gc.get_conditional_format_style(cell_b4.to_sheet_pos(sheet_id), gc.a1_context());

        assert!(
            style_b2_ascending.is_none(),
            "B2 (displaying 100) should NOT have conditional format after ascending sort"
        );
        assert!(
            style_b3_ascending.is_none(),
            "B3 (displaying 500) should NOT have conditional format after ascending sort"
        );
        assert!(
            style_b4_ascending.is_some(),
            "B4 (displaying 1000) should have conditional format after ascending sort"
        );
    }

    /// Helper to assert conditional format is applied correctly to table data cells.
    /// Values: B2=10 (>5), B3=3 (<5), B4=7 (>5). Expects B2 and B4 styled, B3 not.
    fn assert_conditional_format_colors_table_cells(
        gc: &GridController,
        sheet_id: crate::grid::SheetId,
        selection_type: &str,
    ) {
        let rect = Rect::new_span(pos![B2], pos![B4]);
        let mut cells = gc.sheet(sheet_id).get_render_cells(rect, gc.a1_context());
        gc.apply_conditional_formatting_to_cells(sheet_id, rect, &mut cells);

        let cell_b2 = cells.iter().find(|c| c.x == 2 && c.y == 2);
        let cell_b3 = cells.iter().find(|c| c.x == 2 && c.y == 3);
        let cell_b4 = cells.iter().find(|c| c.x == 2 && c.y == 4);

        assert!(
            cell_b2.is_some(),
            "[{}] Render cells should include B2",
            selection_type
        );
        assert!(
            cell_b2.unwrap().bold == Some(true),
            "[{}] B2 (10>5) should have conditional format bold",
            selection_type
        );

        assert!(
            cell_b3.is_some(),
            "[{}] Render cells should include B3",
            selection_type
        );
        assert!(
            cell_b3.unwrap().bold != Some(true),
            "[{}] B3 (3<5) should NOT have conditional format",
            selection_type
        );

        assert!(
            cell_b4.is_some(),
            "[{}] Render cells should include B4",
            selection_type
        );
        assert!(
            cell_b4.unwrap().bold == Some(true),
            "[{}] B4 (7>5) should have conditional format bold",
            selection_type
        );

        let fills = gc.get_conditional_format_fills(sheet_id, rect, gc.a1_context());
        assert!(
            fills.iter().any(|(r, _)| r.contains(pos![B2])),
            "[{}] B2 should have fill",
            selection_type
        );
        assert!(
            fills.iter().any(|(r, _)| r.contains(pos![B4])),
            "[{}] B4 should have fill",
            selection_type
        );
        assert!(
            !fills.iter().any(|(r, _)| r.contains(pos![B3])),
            "[{}] B3 should NOT have fill",
            selection_type
        );
    }

    /// Tests that conditional formatting works on table data with an A1 range selection
    /// (e.g., "B2:B4") - no table refs. Both styles and fills should color cells properly.
    #[test]
    fn test_conditional_format_on_table_data_a1_selection() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let table_pos = pos![B2];
        test_create_data_table_no_ui(&mut gc, sheet_id, table_pos, 1, 3);

        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y,
                sheet_id,
            },
            "10".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y + 1,
                sheet_id,
            },
            "3".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y + 2,
                sheet_id,
            },
            "7".to_string(),
            None,
            false,
        );

        let cf = create_test_conditional_format(
            &gc,
            "B2:B4",
            "=B2>5",
            ConditionalFormatStyle {
                bold: Some(true),
                fill_color: Some("green".to_string()),
                ..Default::default()
            },
        );
        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        assert_conditional_format_colors_table_cells(&gc, sheet_id, "A1 selection");
    }

    /// Tests that conditional formatting works on table data with a table column ref
    /// selection (e.g., "test_table[Column 1]"). Both styles and fills should color cells properly.
    #[test]
    fn test_conditional_format_on_table_data_table_ref_selection() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let table_pos = pos![B2];
        test_create_data_table_no_ui(&mut gc, sheet_id, table_pos, 1, 3);

        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y,
                sheet_id,
            },
            "10".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y + 1,
                sheet_id,
            },
            "3".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            crate::SheetPos {
                x: table_pos.x,
                y: table_pos.y + 2,
                sheet_id,
            },
            "7".to_string(),
            None,
            false,
        );

        let cf = create_test_conditional_format_table_ref(
            &gc,
            "test_table[Column 1]",
            "=B2>5",
            ConditionalFormatStyle {
                bold: Some(true),
                fill_color: Some("green".to_string()),
                ..Default::default()
            },
        );
        gc.sheet_mut(sheet_id).conditional_formats.set(cf, sheet_id);

        assert_conditional_format_colors_table_cells(&gc, sheet_id, "table ref selection");
    }
}
