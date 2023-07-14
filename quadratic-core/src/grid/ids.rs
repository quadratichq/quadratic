use serde::{Deserialize, Serialize};
use uuid::Uuid;

macro_rules! uuid_wrapper_struct {
    ($name:ident) => {
        #[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
        #[serde(transparent)]
        pub struct $name(Uuid);
        impl $name {
            pub(super) fn new() -> Self {
                $name(Uuid::new_v4())
            }
        }
    };
}

uuid_wrapper_struct!(SheetId);
uuid_wrapper_struct!(RowId);
uuid_wrapper_struct!(ColumnId);

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct CellRef {
    pub sheet: SheetId,
    pub column: ColumnId,
    pub row: RowId,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct RegionRef {
    pub top_left: CellRef,
    pub w: u32,
    pub h: u32,
}
