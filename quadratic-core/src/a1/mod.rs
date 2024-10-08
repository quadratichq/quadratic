mod a1_col_pos;
pub mod a1_error;
pub mod a1_from_to;
pub mod a1_range;
pub mod a1_sheet_name;

pub use a1_error::A1Error;
pub use a1_range::*;
pub use a1_sheet_name::SheetNameIdMap;

#[derive(Debug, PartialEq)]
pub struct A1 {
    pub ranges: Vec<A1Range>,
}
