mod a1_sheet_name;
mod cell_ref;
mod cell_ref_request;
mod column_names;
mod error;
mod selection;
mod selection_select;
mod subspaces;

pub use a1_sheet_name::*;
pub use cell_ref::*;
pub use cell_ref_request::*;
pub use column_names::*;
pub use error::*;
pub use selection::*;
pub use subspaces::*;

/// Name to use when a sheet ID has no corresponding name.
///
/// This isn't reserved, but also ideally the user will never see it. If we
/// decide at sometime in the future that we'd prefer to handle the error in a
/// different way, then just delete this constant and follow the errors.
pub(crate) const UNKNOWN_SHEET_NAME: &str = "UnknownSheet";

// TODO(perf): raise or remove upper bound on proptest to test larger ranges.
#[cfg(test)]
pub(crate) const PROPTEST_COORDINATE_I64: std::ops::RangeInclusive<i64> = 1..=16_i64;
#[cfg(test)]
pub(crate) const PROPTEST_COORDINATE_U64: std::ops::RangeInclusive<u64> = 1..=16_u64;
#[cfg(test)]
pub(crate) fn proptest_positions_iter() -> impl Iterator<Item = crate::Pos> {
    itertools::iproduct!(PROPTEST_COORDINATE_I64, PROPTEST_COORDINATE_I64)
        .map(|(y, x)| crate::Pos { x, y })
}