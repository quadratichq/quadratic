mod a1_context;
mod a1_selection;
mod cell_ref_coord;
mod cell_ref_end;
mod cell_ref_range;
mod column_names;
mod error;
mod ref_range_bounds;
mod sheet_cell_ref_range;
mod sheet_name;
mod table_ref;

pub use a1_context::*;
pub use a1_selection::*;
pub use cell_ref_coord::*;
pub use cell_ref_end::*;
pub use cell_ref_range::*;
pub use column_names::*;
pub use error::*;
pub use ref_range_bounds::*;
pub use sheet_cell_ref_range::*;
pub(crate) use sheet_name::*;
pub use table_ref::*;

#[cfg(test)]
pub(crate) const PROPTEST_COORDINATE_I64: std::ops::RangeInclusive<i64> = 1..=16_i64;
// #[cfg(test)]
// pub(crate) const PROPTEST_COORDINATE_U64: std::ops::RangeInclusive<u64> = 1..=16_u64;
#[cfg(test)]
pub(crate) fn proptest_positions_iter() -> impl Iterator<Item = crate::Pos> {
    itertools::iproduct!(PROPTEST_COORDINATE_I64, PROPTEST_COORDINATE_I64)
        .map(|(y, x)| crate::Pos { x, y })
}
