use super::format_update::FormatUpdate;
use crate::RunLengthEncoding;
use serde::{Deserialize, Serialize};
use std::ops::{Deref, DerefMut};

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repeat() {
        let update = FormatUpdate::default();
        let formats = Formats::repeat(update.clone(), 3);
        assert_eq!(formats.size(), 3);
        assert_eq!(formats.get_at(0), Some(&update));
        assert_eq!(formats.get_at(1), Some(&update));
        assert_eq!(formats.get_at(2), Some(&update));
    }
}
