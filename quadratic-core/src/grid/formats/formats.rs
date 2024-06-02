use std::ops::{Deref, DerefMut};
use crate::RunLengthEncoding;
use serde::{Deserialize, Serialize};
use super::format_update::FormatUpdate;

/// Used to store changes from a Format to another Format.
#[derive(Default, Serialize, Deserialize, Debug, Clone, Eq, PartialEq)]
pub struct Formats {
    pub formats: RunLengthEncoding<FormatUpdate>,
}

impl Formats {
    pub fn repeat(update: FormatUpdate, count: usize) -> Self {
        let mut formats = Formats::default();
        formats.push_n(update, count);
        formats
    }
}

impl Deref for Formats {
    type Target = RunLengthEncoding<FormatUpdate>;

    fn deref(&self) -> &Self::Target {
        &self.formats
    }
}

impl DerefMut for Formats {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.formats
    }
}
