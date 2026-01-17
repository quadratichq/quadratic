//! Conditional Formatting for a Sheet.

pub mod color_scale;
mod evaluate;
pub mod rules;

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

pub use color_scale::{ColorScale, ColorScaleThreshold, ColorScaleThresholdValueType};
pub use rules::{ConditionalFormatRule, ConditionalFormatValue};

use crate::{
    Rect,
    a1::{A1Context, A1Selection},
    controller::operations::operation::Operation,
    formulas::ast::Formula,
    grid::{SheetId, bounds::GridBounds},
};

/// The configuration for a conditional format - either formula-based or color scale.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[serde(tag = "type")]
pub enum ConditionalFormatConfig {
    /// Formula-based conditional format that applies a style when a condition is true.
    Formula {
        /// The formula that determines whether to apply the format.
        /// When evaluated for a cell, if the result is truthy, the format is applied.
        #[ts(skip)]
        rule: Formula,

        /// The style to apply when the condition is true.
        style: ConditionalFormatStyle,
    },

    /// Color scale that applies a gradient of colors based on numeric cell values.
    ColorScale {
        /// The color scale configuration with threshold points.
        color_scale: ColorScale,
    },
}

impl ConditionalFormatConfig {
    /// Returns the style if this is a formula-based config, None for color scales.
    pub fn style(&self) -> Option<&ConditionalFormatStyle> {
        match self {
            ConditionalFormatConfig::Formula { style, .. } => Some(style),
            ConditionalFormatConfig::ColorScale { .. } => None,
        }
    }

    /// Returns the formula if this is a formula-based config, None for color scales.
    pub fn formula(&self) -> Option<&Formula> {
        match self {
            ConditionalFormatConfig::Formula { rule, .. } => Some(rule),
            ConditionalFormatConfig::ColorScale { .. } => None,
        }
    }

    /// Returns the color scale if this is a color scale config, None for formula-based.
    pub fn color_scale(&self) -> Option<&ColorScale> {
        match self {
            ConditionalFormatConfig::Formula { .. } => None,
            ConditionalFormatConfig::ColorScale { color_scale } => Some(color_scale),
        }
    }

    /// Returns true if this config has a fill color (either static or color scale).
    pub fn has_fill(&self) -> bool {
        match self {
            ConditionalFormatConfig::Formula { style, .. } => style.fill_color.is_some(),
            ConditionalFormatConfig::ColorScale { .. } => true,
        }
    }

    /// Returns true if this config has non-fill styles (text styling).
    /// For formula-based formats, checks if any text style is set.
    /// For color scales, returns true if `invert_text_on_dark` is enabled.
    pub fn has_non_fill_style(&self) -> bool {
        match self {
            ConditionalFormatConfig::Formula { style, .. } => style.has_non_fill_style(),
            ConditionalFormatConfig::ColorScale { color_scale } => color_scale.invert_text_on_dark,
        }
    }
}

/// The styling properties that can be applied by conditional formatting.
/// Only these properties are supported - other format properties are ignored.
/// Each field that is `Some` will override the existing format; `None` means
/// "don't change the existing format for this property".
#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ConditionalFormatStyle {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub bold: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub italic: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub underline: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub strike_through: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub text_color: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub fill_color: Option<String>,
}

impl ConditionalFormatStyle {
    /// Returns true if no style properties are set.
    pub fn is_empty(&self) -> bool {
        self.bold.is_none()
            && self.italic.is_none()
            && self.underline.is_none()
            && self.strike_through.is_none()
            && self.text_color.is_none()
            && self.fill_color.is_none()
    }

    /// Returns true if any style property other than fill_color is set.
    pub fn has_non_fill_style(&self) -> bool {
        self.bold.is_some()
            || self.italic.is_some()
            || self.underline.is_some()
            || self.strike_through.is_some()
            || self.text_color.is_some()
    }
}

/// A single conditional format rule.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ConditionalFormat {
    /// Unique identifier for this conditional format rule.
    pub id: Uuid,

    /// The selection of cells this conditional format applies to.
    pub selection: A1Selection,

    /// The configuration for this conditional format (formula-based or color scale).
    pub config: ConditionalFormatConfig,

    /// Whether to apply the format to blank cells.
    /// If None, uses the default based on the rule type.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub apply_to_blank: Option<bool>,
}

impl ConditionalFormat {
    /// Returns the style if this is a formula-based format, None for color scales.
    pub fn style(&self) -> Option<&ConditionalFormatStyle> {
        self.config.style()
    }

    /// Returns the formula if this is a formula-based format, None for color scales.
    pub fn formula(&self) -> Option<&Formula> {
        self.config.formula()
    }

    /// Returns the color scale if this is a color scale format, None for formula-based.
    pub fn color_scale(&self) -> Option<&ColorScale> {
        self.config.color_scale()
    }

    /// Returns true if this format has a fill (either static or color scale).
    pub fn has_fill(&self) -> bool {
        self.config.has_fill()
    }

    /// Returns true if this format has non-fill styles (only applicable to formula-based).
    pub fn has_non_fill_style(&self) -> bool {
        self.config.has_non_fill_style()
    }
}

impl ConditionalFormat {
    /// Converts this conditional format to a client-friendly version
    /// with the parsed rule for display/editing.
    pub fn to_client(&self, sheet_id: SheetId, a1_context: &A1Context) -> ConditionalFormatClient {
        match &self.config {
            ConditionalFormatConfig::Formula { rule, style } => {
                let parsed_rule = ConditionalFormatRule::from_formula(
                    rule,
                    Some(sheet_id),
                    a1_context,
                    &self.selection,
                );
                ConditionalFormatClient {
                    id: self.id,
                    selection: self.selection.clone(),
                    config: ConditionalFormatConfigClient::Formula {
                        style: style.clone(),
                        rule: parsed_rule.clone(),
                    },
                    apply_to_blank: self
                        .apply_to_blank
                        .unwrap_or_else(|| parsed_rule.default_apply_to_blank()),
                }
            }
            ConditionalFormatConfig::ColorScale { color_scale } => ConditionalFormatClient {
                id: self.id,
                selection: self.selection.clone(),
                config: ConditionalFormatConfigClient::ColorScale {
                    color_scale: color_scale.clone(),
                },
                // Color scales don't apply to blank cells by default
                apply_to_blank: self.apply_to_blank.unwrap_or(false),
            },
        }
    }

    /// Returns whether this format should apply to blank cells.
    /// If `apply_to_blank` is None, uses the default based on the rule type.
    pub fn should_apply_to_blank(&self, sheet_id: SheetId, a1_context: &A1Context) -> bool {
        self.apply_to_blank.unwrap_or_else(|| {
            match &self.config {
                ConditionalFormatConfig::Formula { rule, .. } => {
                    let parsed_rule = ConditionalFormatRule::from_formula(
                        rule,
                        Some(sheet_id),
                        a1_context,
                        &self.selection,
                    );
                    parsed_rule.default_apply_to_blank()
                }
                // Color scales don't apply to blank cells by default
                ConditionalFormatConfig::ColorScale { .. } => false,
            }
        })
    }
}

/// Client-friendly configuration for a conditional format.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[serde(tag = "type")]
pub enum ConditionalFormatConfigClient {
    /// Formula-based conditional format with parsed rule for display/editing.
    Formula {
        /// The style to apply when the condition is true.
        style: ConditionalFormatStyle,

        /// The parsed rule for display/editing.
        rule: ConditionalFormatRule,
    },

    /// Color scale configuration.
    ColorScale {
        /// The color scale configuration with threshold points.
        color_scale: ColorScale,
    },
}

/// Conditional format for client communication.
/// This includes the parsed rule for easy display/editing.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ConditionalFormatClient {
    /// Unique identifier for this conditional format rule.
    pub id: Uuid,

    /// The selection of cells this conditional format applies to.
    pub selection: A1Selection,

    /// The configuration for this conditional format.
    pub config: ConditionalFormatConfigClient,

    /// Whether to apply the format to blank cells.
    pub apply_to_blank: bool,
}

/// Update configuration from the client.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
#[serde(tag = "type")]
pub enum ConditionalFormatConfigUpdate {
    /// Formula-based conditional format.
    Formula {
        /// The formula string (will be parsed into AST).
        rule: String,

        /// The style to apply when the condition is true.
        style: ConditionalFormatStyle,
    },

    /// Color scale configuration.
    ColorScale {
        /// The color scale configuration with threshold points.
        color_scale: ColorScale,
    },
}

/// Update type for creating/updating conditional formats from the client.
/// Similar to ValidationUpdate, allows optional id for new vs existing.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ConditionalFormatUpdate {
    /// If None, a new conditional format will be created with a new UUID.
    /// If Some, the existing conditional format with this ID will be updated.
    pub id: Option<Uuid>,

    /// The sheet this conditional format belongs to.
    pub sheet_id: String,

    /// The selection of cells as an A1 notation string.
    pub selection: String,

    /// The configuration for this conditional format.
    pub config: ConditionalFormatConfigUpdate,

    /// Whether to apply the format to blank cells.
    /// If None, uses the default based on the rule type.
    pub apply_to_blank: Option<bool>,
}

/// Container for all conditional formats in a sheet.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ConditionalFormats {
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) conditional_formats: Vec<ConditionalFormat>,

    /// Cached bounding box encompassing all conditional format selections.
    /// None means cache needs to be rebuilt.
    #[serde(skip)]
    bounds_cache: Option<GridBounds>,
}

impl Default for ConditionalFormats {
    fn default() -> Self {
        Self::new()
    }
}

impl ConditionalFormats {
    /// Creates a new empty ConditionalFormats.
    pub fn new() -> Self {
        Self {
            conditional_formats: Vec::new(),
            bounds_cache: None,
        }
    }

    /// Creates a ConditionalFormats from a vector of ConditionalFormat.
    pub fn from_vec(conditional_formats: Vec<ConditionalFormat>) -> Self {
        Self {
            conditional_formats,
            bounds_cache: None,
        }
    }

    /// Returns true if there are no conditional formats.
    pub fn is_empty(&self) -> bool {
        self.conditional_formats.is_empty()
    }

    /// Returns the number of conditional formats.
    pub fn len(&self) -> usize {
        self.conditional_formats.len()
    }

    /// Returns an iterator over the conditional formats.
    pub fn iter(&self) -> impl Iterator<Item = &ConditionalFormat> {
        self.conditional_formats.iter()
    }

    /// Returns a conditional format by its ID.
    pub fn get(&self, id: Uuid) -> Option<&ConditionalFormat> {
        self.conditional_formats.iter().find(|cf| cf.id == id)
    }

    /// Returns a mutable reference to a conditional format by its ID.
    pub fn get_mut(&mut self, id: Uuid) -> Option<&mut ConditionalFormat> {
        self.conditional_formats.iter_mut().find(|cf| cf.id == id)
    }

    /// Invalidates the bounds cache. Call this when formats are modified.
    fn invalidate_cache(&mut self) {
        self.bounds_cache = None;
    }

    /// Returns the cached bounds, computing it if necessary.
    pub fn bounds(&mut self, a1_context: &A1Context) -> GridBounds {
        if let Some(cached) = self.bounds_cache {
            return cached;
        }

        let mut bounds = GridBounds::Empty;
        for cf in &self.conditional_formats {
            let rect = cf.selection.largest_rect_finite(a1_context);
            if !rect.is_empty() {
                bounds.add_rect(rect);
            }
        }

        self.bounds_cache = Some(bounds);
        bounds
    }

    /// Returns all conditional formats that overlap with a selection.
    pub fn overlaps_selection(
        &self,
        selection: &A1Selection,
        a1_context: &A1Context,
    ) -> Vec<&ConditionalFormat> {
        self.conditional_formats
            .iter()
            .filter(|cf| cf.selection.overlaps_a1_selection(selection, a1_context))
            .collect()
    }

    /// Returns conditional formats that might apply to cells within the given rect.
    /// Uses the bounds cache for early rejection.
    pub fn in_rect(&mut self, rect: Rect, a1_context: &A1Context) -> Vec<&ConditionalFormat> {
        if self.conditional_formats.is_empty() {
            return vec![];
        }

        // Check bounds for early rejection
        if let GridBounds::NonEmpty(bounds) = self.bounds(a1_context)
            && !bounds.intersects(rect)
        {
            return vec![];
        }

        // Filter to only formats that intersect the rect
        self.conditional_formats
            .iter()
            .filter(|cf| cf.selection.contains_rect(rect, a1_context))
            .collect()
    }

    /// Sets (adds or updates) a conditional format. Returns the reverse operation.
    /// Invalidates the cache.
    pub fn set(&mut self, format: ConditionalFormat, sheet_id: SheetId) -> Operation {
        if let Some(existing) = self
            .conditional_formats
            .iter_mut()
            .find(|cf| cf.id == format.id)
        {
            let old_format = existing.clone();
            *existing = format;
            self.invalidate_cache();
            Operation::SetConditionalFormat {
                conditional_format: old_format,
            }
        } else {
            let reverse = Operation::RemoveConditionalFormat {
                sheet_id,
                conditional_format_id: format.id,
            };
            self.conditional_formats.push(format);
            self.invalidate_cache();
            reverse
        }
    }

    /// Removes a conditional format by ID. Returns the reverse operation if found.
    /// Invalidates the cache.
    pub fn remove(&mut self, id: Uuid) -> Option<Operation> {
        let mut reverse = None;
        self.conditional_formats.retain(|cf| {
            if cf.id == id {
                reverse = Some(Operation::SetConditionalFormat {
                    conditional_format: cf.clone(),
                });
                false
            } else {
                true
            }
        });
        if reverse.is_some() {
            self.invalidate_cache();
        }
        reverse
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{a1::A1Selection, formulas::parse_formula};

    fn create_test_format(selection: &str, style: ConditionalFormatStyle) -> ConditionalFormat {
        let a1_selection = A1Selection::test_a1(selection);
        let a1_context = A1Context::default();
        let pos = a1_selection.cursor.to_sheet_pos(a1_selection.sheet_id);
        let rule = parse_formula("=TRUE", &a1_context, pos).unwrap();
        ConditionalFormat {
            id: Uuid::new_v4(),
            selection: a1_selection,
            config: ConditionalFormatConfig::Formula { rule, style },
            apply_to_blank: None,
        }
    }

    fn create_test_color_scale(selection: &str) -> ConditionalFormat {
        let a1_selection = A1Selection::test_a1(selection);
        ConditionalFormat {
            id: Uuid::new_v4(),
            selection: a1_selection,
            config: ConditionalFormatConfig::ColorScale {
                color_scale: ColorScale::default(),
            },
            apply_to_blank: None,
        }
    }

    #[test]
    fn test_conditional_format_style_is_empty() {
        let style = ConditionalFormatStyle::default();
        assert!(style.is_empty());

        let style = ConditionalFormatStyle {
            bold: Some(true),
            ..Default::default()
        };
        assert!(!style.is_empty());

        let style = ConditionalFormatStyle {
            fill_color: Some("red".to_string()),
            ..Default::default()
        };
        assert!(!style.is_empty());
    }

    #[test]
    fn test_conditional_format_style_has_non_fill_style() {
        let style = ConditionalFormatStyle::default();
        assert!(!style.has_non_fill_style());

        // Only fill_color should return false
        let style = ConditionalFormatStyle {
            fill_color: Some("red".to_string()),
            ..Default::default()
        };
        assert!(!style.has_non_fill_style());

        // Each non-fill property should return true
        let style = ConditionalFormatStyle {
            bold: Some(true),
            ..Default::default()
        };
        assert!(style.has_non_fill_style());

        let style = ConditionalFormatStyle {
            italic: Some(true),
            ..Default::default()
        };
        assert!(style.has_non_fill_style());

        let style = ConditionalFormatStyle {
            underline: Some(true),
            ..Default::default()
        };
        assert!(style.has_non_fill_style());

        let style = ConditionalFormatStyle {
            strike_through: Some(true),
            ..Default::default()
        };
        assert!(style.has_non_fill_style());

        let style = ConditionalFormatStyle {
            text_color: Some("blue".to_string()),
            ..Default::default()
        };
        assert!(style.has_non_fill_style());

        // Both fill and non-fill should return true
        let style = ConditionalFormatStyle {
            bold: Some(true),
            fill_color: Some("red".to_string()),
            ..Default::default()
        };
        assert!(style.has_non_fill_style());
    }

    #[test]
    fn test_conditional_formats_set_and_get() {
        let mut formats = ConditionalFormats::new();
        let sheet_id = SheetId::TEST;

        assert!(formats.is_empty());
        assert_eq!(formats.len(), 0);

        let cf = create_test_format(
            "A1:B2",
            ConditionalFormatStyle {
                bold: Some(true),
                ..Default::default()
            },
        );
        let cf_id = cf.id;

        // Add new format
        let reverse_op = formats.set(cf.clone(), sheet_id);
        assert_eq!(formats.len(), 1);
        assert!(!formats.is_empty());

        // Verify we can get it
        let retrieved = formats.get(cf_id);
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, cf_id);

        // Verify reverse operation is RemoveConditionalFormat
        match reverse_op {
            Operation::RemoveConditionalFormat {
                conditional_format_id,
                ..
            } => {
                assert_eq!(conditional_format_id, cf_id);
            }
            _ => panic!("Expected RemoveConditionalFormat operation"),
        }

        // Update existing format
        let mut updated_cf = cf.clone();
        if let ConditionalFormatConfig::Formula { ref mut style, .. } = updated_cf.config {
            style.italic = Some(true);
        }
        let reverse_op = formats.set(updated_cf, sheet_id);
        assert_eq!(formats.len(), 1); // Still 1

        // Verify reverse operation is SetConditionalFormat with old value
        match reverse_op {
            Operation::SetConditionalFormat {
                conditional_format: old_cf,
            } => {
                assert_eq!(old_cf.id, cf_id);
                let old_style = old_cf.style().unwrap();
                assert_eq!(old_style.bold, Some(true));
                assert_eq!(old_style.italic, None); // Old value
            }
            _ => panic!("Expected SetConditionalFormat operation"),
        }

        // Verify update was applied
        let retrieved = formats.get(cf_id).unwrap();
        assert_eq!(retrieved.style().unwrap().italic, Some(true));
    }

    #[test]
    fn test_conditional_formats_remove() {
        let mut formats = ConditionalFormats::new();
        let sheet_id = SheetId::TEST;

        let cf = create_test_format(
            "A1:B2",
            ConditionalFormatStyle {
                bold: Some(true),
                ..Default::default()
            },
        );
        let cf_id = cf.id;

        formats.set(cf, sheet_id);
        assert_eq!(formats.len(), 1);

        // Remove non-existent ID returns None
        let result = formats.remove(Uuid::new_v4());
        assert!(result.is_none());
        assert_eq!(formats.len(), 1);

        // Remove existing ID
        let result = formats.remove(cf_id);
        assert!(result.is_some());
        assert_eq!(formats.len(), 0);

        // Verify reverse operation
        match result.unwrap() {
            Operation::SetConditionalFormat {
                conditional_format: old_cf,
            } => {
                assert_eq!(old_cf.id, cf_id);
            }
            _ => panic!("Expected SetConditionalFormat operation"),
        }
    }

    #[test]
    fn test_conditional_formats_bounds() {
        let mut formats = ConditionalFormats::new();
        let sheet_id = SheetId::TEST;
        let a1_context = A1Context::default();

        // Empty formats have empty bounds
        assert_eq!(formats.bounds(&a1_context), GridBounds::Empty);

        // Add format for A1:B2
        let cf1 = create_test_format("A1:B2", ConditionalFormatStyle::default());
        formats.set(cf1, sheet_id);

        let bounds = formats.bounds(&a1_context);
        match bounds {
            GridBounds::NonEmpty(rect) => {
                assert_eq!(rect, Rect::test_a1("A1:B2"));
            }
            _ => panic!("Expected NonEmpty bounds"),
        }

        // Add format for D4:E5 - bounds should expand
        let cf2 = create_test_format("D4:E5", ConditionalFormatStyle::default());
        formats.set(cf2, sheet_id);

        let bounds = formats.bounds(&a1_context);
        match bounds {
            GridBounds::NonEmpty(rect) => {
                assert_eq!(rect, Rect::test_a1("A1:E5"));
            }
            _ => panic!("Expected NonEmpty bounds"),
        }
    }

    #[test]
    fn test_conditional_formats_get_mut() {
        let mut formats = ConditionalFormats::new();
        let sheet_id = SheetId::TEST;

        let cf = create_test_format(
            "A1:B2",
            ConditionalFormatStyle {
                bold: Some(true),
                ..Default::default()
            },
        );
        let cf_id = cf.id;
        formats.set(cf, sheet_id);

        // Get mutable reference and modify
        let cf_mut = formats.get_mut(cf_id).unwrap();
        if let ConditionalFormatConfig::Formula { ref mut style, .. } = cf_mut.config {
            style.italic = Some(true);
        }

        // Verify modification persisted
        let retrieved = formats.get(cf_id).unwrap();
        assert_eq!(retrieved.style().unwrap().italic, Some(true));

        // Non-existent ID returns None
        assert!(formats.get_mut(Uuid::new_v4()).is_none());
    }

    #[test]
    fn test_color_scale_format() {
        let cf = create_test_color_scale("A1:A10");
        assert!(cf.color_scale().is_some());
        assert!(cf.style().is_none());
        assert!(cf.has_fill());
        assert!(!cf.has_non_fill_style());
    }

    #[test]
    fn test_overlaps_selection() {
        let mut formats = ConditionalFormats::new();
        let sheet_id = SheetId::TEST;
        let a1_context = A1Context::default();

        // Add conditional formats
        let cf1 = create_test_format("A1:B2", ConditionalFormatStyle::default());
        let cf2 = create_test_format("D4:E5", ConditionalFormatStyle::default());
        let cf1_id = cf1.id;
        let cf2_id = cf2.id;
        formats.set(cf1, sheet_id);
        formats.set(cf2, sheet_id);

        // Test overlapping selection
        let selection = A1Selection::test_a1("B2:C3");
        let overlapping = formats.overlaps_selection(&selection, &a1_context);
        assert_eq!(overlapping.len(), 1);
        assert_eq!(overlapping[0].id, cf1_id);

        // Test selection that overlaps both
        let selection = A1Selection::test_a1("A1:E5");
        let overlapping = formats.overlaps_selection(&selection, &a1_context);
        assert_eq!(overlapping.len(), 2);

        // Test selection that overlaps neither
        let selection = A1Selection::test_a1("G7:H8");
        let overlapping = formats.overlaps_selection(&selection, &a1_context);
        assert!(overlapping.is_empty());

        // Test selection that overlaps only second
        let selection = A1Selection::test_a1("D4");
        let overlapping = formats.overlaps_selection(&selection, &a1_context);
        assert_eq!(overlapping.len(), 1);
        assert_eq!(overlapping[0].id, cf2_id);
    }
}
