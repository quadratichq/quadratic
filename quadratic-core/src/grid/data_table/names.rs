use lazy_static::lazy_static;
use regex::Regex;

use crate::{MultiPos, a1::A1Context, util::unique_name};

/// Returns a unique name for the data table, taking into account its
/// position on the sheet (so it doesn't conflict with itself).
pub fn unique_data_table_name(
    name: &str,
    require_number: bool,
    multi_pos: Option<MultiPos>,
    a1_context: &A1Context,
) -> String {
    // replace spaces with underscores
    let name = name.replace(' ', "_");

    let check_name = |name: &str| !a1_context.table_map.contains_name(name, multi_pos);
    let iter_names = a1_context.table_map.iter_rev_table_names();
    unique_name(&name, require_number, check_name, iter_names)
}

pub const A1_REGEX: &str = r#"\b\$?[a-zA-Z]+\$\d+\b"#;
pub const R1C1_REGEX: &str = r#"\bR\d+C\d+\b"#;
pub const TABLE_NAME_VALID_CHARS: &str = r#"^[a-zA-Z_\\][a-zA-Z0-9_.]*$"#;
pub const COLUMN_NAME_VALID_CHARS: &str =
    r#"^[a-zA-Z0-9_\-]([a-zA-Z0-9_\- .()\p{Pd}]*[a-zA-Z0-9_\-)])?$"#;
lazy_static! {
    pub static ref A1_REGEX_COMPILED: Regex =
        Regex::new(A1_REGEX).expect("Failed to compile A1_REGEX");
    pub static ref R1C1_REGEX_COMPILED: Regex =
        Regex::new(R1C1_REGEX).expect("Failed to compile R1C1_REGEX");
    pub static ref TABLE_NAME_VALID_CHARS_COMPILED: Regex =
        Regex::new(TABLE_NAME_VALID_CHARS).expect("Failed to compile TABLE_NAME_VALID_CHARS");
    pub static ref COLUMN_NAME_VALID_CHARS_COMPILED: Regex =
        Regex::new(COLUMN_NAME_VALID_CHARS).expect("Failed to compile COLUMN_NAME_VALID_CHARS");
}
