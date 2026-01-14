//! Conditional Formatting for a Sheet.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{a1::A1Selection, formulas::ast::Formula};

/// The styling properties that can be applied by conditional formatting.
/// Only these properties are supported - other format properties are ignored.
/// Each field that is `Some` will override the existing format; `None` means
/// "don't change the existing format for this property".
#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
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
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
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
    pub rule: Formula,
}

/// Container for all conditional formats in a sheet.
#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ConditionalFormats {
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) conditional_formats: Vec<ConditionalFormat>,
}

impl ConditionalFormats {
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
}
