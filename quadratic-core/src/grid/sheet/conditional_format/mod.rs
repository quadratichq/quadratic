//! Conditional Formatting for a Sheet.

mod evaluate;
pub mod rules;

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

pub use rules::{ConditionalFormatRule, ConditionalFormatValue};

use crate::{
    Rect,
    a1::{A1Context, A1Selection},
    controller::operations::operation::Operation,
    formulas::ast::Formula,
    grid::{SheetId, bounds::GridBounds},
};

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
}

/// A single conditional format rule.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ConditionalFormat {
    /// Unique identifier for this conditional format rule.
    pub id: Uuid,

    /// The selection of cells this conditional format applies to.
    pub selection: A1Selection,

    /// The style to apply when the condition is true.
    /// Only properties that are `Some` will override the existing format.
    pub style: ConditionalFormatStyle,

    /// The formula that determines whether to apply the format.
    /// When evaluated for a cell, if the result is truthy, the format is applied.
    #[ts(skip)]
    pub rule: Formula,
}

impl ConditionalFormat {
    /// Converts this conditional format to a client-friendly version
    /// with the parsed rule for display/editing.
    pub fn to_client(&self, sheet_id: SheetId, a1_context: &A1Context) -> ConditionalFormatClient {
        ConditionalFormatClient {
            id: self.id,
            selection: self.selection.clone(),
            style: self.style.clone(),
            rule: ConditionalFormatRule::from_formula(&self.rule, Some(sheet_id), a1_context),
        }
    }
}

/// Conditional format for client communication.
/// This includes the parsed rule for easy display/editing.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ConditionalFormatClient {
    /// Unique identifier for this conditional format rule.
    pub id: Uuid,

    /// The selection of cells this conditional format applies to.
    pub selection: A1Selection,

    /// The style to apply when the condition is true.
    pub style: ConditionalFormatStyle,

    /// The parsed rule for display/editing.
    pub rule: ConditionalFormatRule,
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

    /// The style to apply when the condition is true.
    pub style: ConditionalFormatStyle,

    /// The formula string (will be parsed into AST).
    pub rule: String,
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

    /// Returns conditional formats that might apply to cells within the given rect.
    /// Uses the bounds cache for early rejection.
    pub fn in_rect(&mut self, rect: Rect, a1_context: &A1Context) -> Vec<&ConditionalFormat> {
        if self.conditional_formats.is_empty() {
            return vec![];
        }

        // Check bounds for early rejection
        if let GridBounds::NonEmpty(bounds) = self.bounds(a1_context) {
            if !bounds.intersects(rect) {
                return vec![];
            }
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
