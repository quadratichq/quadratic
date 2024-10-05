mod a1_error;
mod a1_from_a1;
mod a1_from_a1_relative;
pub(crate) mod a1_parts;
mod a1_to_a1;

use crate::grid::SheetId;
use std::collections::HashMap;

pub use a1_error::A1Error;

#[derive(Debug)]
pub struct A1 {}

pub type SheetNameIdMap = HashMap<String, SheetId>;
