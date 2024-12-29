mod a1_context;
mod a1_selection;
mod a1_sheet_name;
mod cell_ref_coord;
mod cell_ref_end;
mod cell_ref_range;
mod column_names;
mod error;
pub mod js_selection;
mod ref_range_bounds;
mod sheet_cell_ref_range;
mod table_ref;

pub use a1_context::*;
pub use a1_selection::*;
pub(crate) use a1_sheet_name::*;
pub use cell_ref_coord::*;
pub use cell_ref_end::*;
pub use cell_ref_range::*;
pub use column_names::*;
pub use error::*;
pub(crate) use ref_range_bounds::*;
pub use sheet_cell_ref_range::*;
pub use table_ref::*;

// TODO(perf): raise or remove upper bound on proptest to test larger ranges.
#[cfg(test)]
pub(crate) const PROPTEST_COORDINATE_I64: std::ops::RangeInclusive<i64> = 1..=16_i64;
// #[cfg(test)]
// pub(crate) const PROPTEST_COORDINATE_U64: std::ops::RangeInclusive<u64> = 1..=16_u64;
#[cfg(test)]
pub(crate) fn proptest_positions_iter() -> impl Iterator<Item = crate::Pos> {
    itertools::iproduct!(PROPTEST_COORDINATE_I64, PROPTEST_COORDINATE_I64)
        .map(|(y, x)| crate::Pos { x, y })
}
