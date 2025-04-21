use serde::{Deserialize, Serialize};

/// Determine whether to copy the formats during an Insert operation from the
/// column/row before or after (or none).
#[derive(Default, Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
pub enum CopyFormats {
    #[default]
    None,
    Before,
    After,
}
