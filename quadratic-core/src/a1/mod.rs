mod a1_sheet_name;
mod cell_ref;
mod cell_ref_request;
mod column_names;
mod error;
mod selection;

pub use a1_sheet_name::*;
pub use cell_ref::*;
pub use cell_ref_request::*;
pub use column_names::*;
pub use error::*;
pub use selection::*;

/// Name to use when a sheet ID has no corresponding name.
///
/// This isn't reserved, but also ideally the user will never see it. If we
/// decide at sometime in the future that we'd prefer to handle the error in a
/// different way, then just delete this constant and follow the errors.
pub(crate) const UNKNOWN_SHEET_NAME: &str = "UnknownSheet";
