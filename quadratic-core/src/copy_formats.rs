use serde::{Deserialize, Serialize};

/// Determine whether to copy the formats during an Insert operation from the
/// column/row before or after (or none).
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
pub enum CopyFormats {
    Before,
    After,
    None,
}
